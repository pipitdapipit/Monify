import 'server-only'
// Import screenshot bank / e-wallet (bukti transfer atau mutasi) menjadi transaksi.
// Dipakai skrip scripts/watch-inbox.mjs. File ini tidak menyentuh filesystem,
// supaya nanti bisa dipanggil juga dari route API.
import { llmBankRowSchema, llmBankScreenshotSchema } from './schemas.js'
import { validDateOrToday } from './receipt.js'
import { parseBankScreenshotImage, parseBankScreenshotText } from './ai.js'
import { HttpError } from './errors.js'
import { detectImageType } from './fileType.js'
import { ocrImage } from './ocr.js'
import { todayJakarta } from './today.js'

const MAX_ROWS = 50
const MAX_NOTE = 60
const MAX_BYTES = 4 * 1024 * 1024
const MIN_OCR_CHARS = 20
const LOW_CONFIDENCE = 0.5

// "Sea Bank" -> "seabank", " B.C.A " -> "bca"
export function normalizeBankName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Dompet dipilih oleh kode (bukan AI) dari nama bank yang terbaca.
export function matchWallet(bank, wallets) {
  const key = normalizeBankName(bank)
  if (!key) return { reason: 'Nama bank tidak terbaca di screenshot' }
  const found = wallets.filter((w) => normalizeBankName(w.name) === key)
  if (found.length === 0) return { reason: `Bank "${bank}" tidak ada di dompet Monify` }
  if (found.length > 1) return { reason: `Bank "${bank}" cocok dengan lebih dari satu dompet` }
  return { wallet: found[0] }
}

// Bersihkan keluaran model (tidak tepercaya). Baris rusak (termasuk tanggal tidak jelas) dibuang
// dan dihitung di dropped.
// Kategori yang bukan milik user / beda jenis diganti "Lainnya" dengan jenis yang sama.
export function cleanBankScreenshot(raw, { today, categories }) {
  const parsed = llmBankScreenshotSchema.safeParse(raw)
  const { bank, transactions, confidence } = parsed.success ? parsed.data : { bank: null, transactions: [], confidence: 0 }

  const fallback = (type) => categories.find((c) => c.type === type && c.name.trim().toLowerCase() === 'lainnya')
  const rows = []
  let dropped = 0
  for (const item of transactions.slice(0, MAX_ROWS)) {
    const result = llmBankRowSchema.safeParse(item)
    if (!result.success) {
      dropped++
      continue
    }
    const r = result.data
    // Tanggal kosong / tidak valid / masa depan: baris dibuang, BUKAN diganti hari ini.
    // Menebak hari ini menyimpan di tanggal salah dan lolos dari cek duplikat besoknya.
    if (validDateOrToday(r.date, today) !== r.date) {
      dropped++
      continue
    }
    const category = categories.find((c) => c.id === r.category_id && c.type === r.type) || fallback(r.type)
    if (!category) {
      const jenis = r.type === 'income' ? 'pemasukan' : 'pengeluaran'
      return { reason: `Kategori "Lainnya" untuk ${jenis} tidak ada di akun Monify` }
    }
    rows.push({
      date: r.date,
      amount: r.amount,
      type: r.type,
      note: r.description.slice(0, MAX_NOTE),
      category_id: category.id,
    })
  }
  return { bank, rows, dropped, confidence: Math.min(1, Math.max(0, confidence)) }
}

// Cegah transaksi ganda dari screenshot yang sama / tumpang-tindih.
// Kunci = tanggal + jenis + nominal (dompet sudah disaring saat mengambil existing).
// Yang disimpan hanya selisih: jumlah di screenshot dikurangi jumlah yang sudah ada,
// jadi dua transaksi identik dalam satu screenshot tetap tercatat dua-duanya.
export function planInserts(rows, existing) {
  const key = (t) => `${t.date}|${t.type}|${Number(t.amount)}`
  const remaining = new Map()
  for (const t of existing) remaining.set(key(t), (remaining.get(key(t)) || 0) + 1)

  const toInsert = []
  let skipped = 0
  for (const row of rows) {
    const left = remaining.get(key(row)) || 0
    if (left > 0) {
      remaining.set(key(row), left - 1)
      skipped++
    } else {
      toInsert.push(row)
    }
  }
  return { toInsert, skipped }
}

const defaultDeps = { ocr: ocrImage, parseText: parseBankScreenshotText, parseImage: parseBankScreenshotImage }

// Alur lengkap satu screenshot: cek file -> OCR -> AI -> validasi -> dompet -> duplikat -> simpan.
// Hasil:
//   { status: 'saved', wallet, inserted, skipped, dropped }
//   { status: 'review', reason }   -> file perlu dicek manual, tidak ada yang disimpan
// Error lain (AI sibuk, internet, Supabase) DILEMPAR: pemanggil boleh mencoba lagi nanti.
// store menentukan cara membaca / menyimpan transaksi (lihat importStores.js).
// deps bisa diganti untuk test (tanpa OCR / AI sungguhan).
export async function importScreenshot({ buffer, store, lists, today = todayJakarta(), deps = defaultDeps }) {
  const review = (reason) => ({ status: 'review', reason })

  const type = detectImageType(buffer)
  if (!type) return review('File bukan gambar JPG, PNG, atau WEBP')
  if (buffer.length > MAX_BYTES) return review('Ukuran gambar lebih dari 4 MB')

  const ctx = { today, categories: lists.categories }
  const visionFallback = process.env.RECEIPT_VISION_FALLBACK === 'true'
  const viaImage = () => deps.parseImage({ image: { buffer, mime: type.mime }, ...ctx })

  let text = ''
  try {
    text = await deps.ocr(buffer, type.ext)
  } catch {
    // Pesan error OCR tidak diteruskan (bisa memuat path file sementara).
  }

  let raw
  if (text.length < MIN_OCR_CHARS) {
    if (!visionFallback) return review('Teks di screenshot tidak terbaca')
    raw = await viaImage()
  } else {
    try {
      raw = await deps.parseText({ text, ...ctx })
    } catch (err) {
      // Model gagal membaca teks (422): dengan vision fallback coba lewat gambar
      if (!(err instanceof HttpError) || err.status !== 422) throw err
      if (!visionFallback) return review('Teks di screenshot tidak terbaca')
      raw = await viaImage()
    }
  }

  const cleaned = cleanBankScreenshot(raw, ctx)
  if (cleaned.reason) return review(cleaned.reason)
  if (cleaned.confidence < LOW_CONFIDENCE) {
    return review(`AI tidak yakin dengan hasil bacaannya (confidence ${cleaned.confidence})`)
  }
  if (cleaned.rows.length === 0) return review('Tidak ada transaksi yang terbaca')

  const match = matchWallet(cleaned.bank, lists.wallets)
  if (match.reason) return review(match.reason)
  const wallet = match.wallet

  const dates = cleaned.rows.map((r) => r.date).sort()
  const existing = await store.findExisting({ walletId: wallet.id, from: dates[0], to: dates[dates.length - 1] })

  const { toInsert, skipped } = planInserts(cleaned.rows, existing)
  // Satu insert: semua baris tersimpan, atau tidak sama sekali.
  if (toInsert.length > 0) await store.insert({ walletId: wallet.id, rows: toInsert })

  return { status: 'saved', wallet: wallet.name, inserted: toInsert.length, skipped, dropped: cleaned.dropped }
}
