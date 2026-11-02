// Penanganan satu file inbox (dipakai scripts/watch-inbox.mjs): import, pindahkan, coba lagi.
// handle() tidak pernah melempar error, supaya satu file bermasalah tidak menghentikan antrian.
import fs from 'node:fs/promises'
import path from 'node:path'
import { moveTo } from './inboxFiles.mjs'

const MAX_ATTEMPTS = 3
// Jeda sebelum mencoba lagi setelah gagal ke-1 dan ke-2 (AI gratis sering sibuk beberapa menit).
const BACKOFF_MS = [60_000, 5 * 60_000]

// Pesan aman untuk log / file .txt: pesan HttpError (punya status), selain itu jenis errornya saja.
function safeMessage(err) {
  if (err?.status) return err.message
  return err?.code || err?.name || 'kesalahan tidak terduga'
}

// importFile(buffer, lists) -> { status: 'saved', ... } | { status: 'review', reason }; melempar = gagal sementara.
export function createProcessor({ inbox, doneDir, reviewDir, importFile, log = console.log, now = Date.now }) {
  const attempts = new Map() // nama -> { count, nextTry }
  // Sudah diimpor tapi belum berhasil dipindah. Tidak diimpor ulang (AI tidak dipanggil lagi).
  const pendingMoves = new Map() // nama -> { toDir, reason, message, saved }

  async function tryMove(name) {
    const move = pendingMoves.get(name)
    try {
      await moveTo(inbox, name, move.toDir, move.reason)
      pendingMoves.delete(name)
      log(move.message)
    } catch (err) {
      // Di Windows, tujuan yang tidak valid juga bisa memberi ENOENT: pastikan sumbernya memang hilang
      const sourceGone = err.code === 'ENOENT' && !(await fs.access(path.join(inbox, name)).then(() => true, () => false))
      if (sourceGone) {
        pendingMoves.delete(name)
        log(
          move.saved
            ? `${name} sudah tidak ada di inbox, tapi ${move.saved} transaksi sudah tersimpan`
            : `${name} sudah tidak ada, dilewati`,
        )
        return
      }
      const saved = move.saved ? `${move.saved} transaksi sudah tersimpan, ` : ''
      log(`… ${name} → ${saved}tapi file gagal dipindah (${safeMessage(err)}), dicoba lagi`)
    }
  }

  async function fail(name, err) {
    const count = (attempts.get(name)?.count || 0) + 1
    const message = safeMessage(err)
    if (count < MAX_ATTEMPTS) {
      attempts.set(name, { count, nextTry: now() + BACKOFF_MS[count - 1] })
      const minutes = BACKOFF_MS[count - 1] / 60_000
      log(`… ${name} → gagal sementara (${message}), dicoba lagi ${minutes} menit lagi (${count}/${MAX_ATTEMPTS})`)
      return
    }
    attempts.delete(name)
    pendingMoves.set(name, {
      toDir: reviewDir,
      reason: `Gagal ${MAX_ATTEMPTS} kali: ${message}`,
      message: `⚠ ${name} → perlu dicek: gagal ${MAX_ATTEMPTS} kali (${message})`,
      saved: 0,
    })
    await tryMove(name)
  }

  return {
    async handle(name, lists) {
      if (pendingMoves.has(name)) return tryMove(name)
      const waiting = attempts.get(name)
      if (waiting && now() < waiting.nextTry) return

      let result
      try {
        const buffer = await fs.readFile(path.join(inbox, name))
        result = await importFile(buffer, lists)
      } catch (err) {
        if (err.code === 'ENOENT') {
          attempts.delete(name)
          log(`${name} sudah tidak ada, dilewati`)
          return
        }
        return fail(name, err)
      }

      attempts.delete(name)
      if (result.status === 'review') {
        pendingMoves.set(name, {
          toDir: reviewDir,
          reason: result.reason,
          message: `⚠ ${name} → perlu dicek: ${result.reason}`,
          saved: 0,
        })
      } else {
        const dropped = result.dropped > 0 ? `, ${result.dropped} baris tidak terbaca` : ''
        pendingMoves.set(name, {
          toDir: doneDir,
          message: `✓ ${name} → ${result.inserted} baru, ${result.skipped} sudah ada (${result.wallet})${dropped}`,
          saved: result.inserted,
        })
      }
      return tryMove(name)
    },

    // Lupakan hitungan untuk file yang sudah tidak ada di inbox.
    prune(names) {
      for (const map of [attempts, pendingMoves]) {
        for (const name of map.keys()) if (!names.includes(name)) map.delete(name)
      }
    },
  }
}
