import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { createProcessor } from './inboxProcessor.mjs'

let root
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'monify-proc-'))
})
after(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

// Folder inbox baru per test, berisi satu file a.png
let n = 0
async function setup({ importFile, now = () => 0 }) {
  const inbox = path.join(root, `inbox-${++n}`)
  const doneDir = path.join(inbox, 'selesai')
  const reviewDir = path.join(inbox, 'perlu-dicek')
  await fs.mkdir(doneDir, { recursive: true })
  await fs.mkdir(reviewDir, { recursive: true })
  await fs.writeFile(path.join(inbox, 'a.png'), 'gambar')
  const logs = []
  const calls = { import: 0 }
  const processor = createProcessor({
    inbox,
    doneDir,
    reviewDir,
    importFile: async (buffer, lists) => {
      calls.import++
      return importFile(buffer, lists)
    },
    log: (line) => logs.push(line),
    now,
  })
  const exists = (...p) => fs.access(path.join(inbox, ...p)).then(() => true, () => false)
  return { inbox, doneDir, processor, logs, calls, exists }
}

const saved = { status: 'saved', wallet: 'BCA', inserted: 2, skipped: 0, dropped: 0 }
const busy = () => {
  throw Object.assign(new Error('AI sedang sibuk. Coba lagi sebentar lagi.'), { status: 503 })
}

test('saved -> selesai dan log', async () => {
  const t = await setup({ importFile: () => saved })
  await t.processor.handle('a.png', {})
  assert.equal(await t.exists('selesai', 'a.png'), true)
  assert.match(t.logs.at(-1), /✓ a\.png → 2 baru, 0 sudah ada \(BCA\)/)
})

test('review -> perlu-dicek dengan alasan', async () => {
  const t = await setup({ importFile: () => ({ status: 'review', reason: 'Bank "Jago" tidak ada' }) })
  await t.processor.handle('a.png', {})
  assert.equal(await fs.readFile(path.join(t.inbox, 'perlu-dicek', 'a.txt'), 'utf8'), 'Bank "Jago" tidak ada')
})

test('gagal sementara: ditunda dengan backoff, lalu perlu-dicek setelah 3 kali', async () => {
  let clock = 0
  const t = await setup({ importFile: busy, now: () => clock })

  await t.processor.handle('a.png', {}) // gagal ke-1, tunggu 1 menit
  assert.equal(await t.exists('a.png'), true)
  clock = 30_000
  await t.processor.handle('a.png', {}) // belum waktunya
  assert.equal(t.calls.import, 1)

  clock = 61_000
  await t.processor.handle('a.png', {}) // gagal ke-2, tunggu 5 menit
  assert.equal(t.calls.import, 2)
  clock = 61_000 + 4 * 60_000
  await t.processor.handle('a.png', {})
  assert.equal(t.calls.import, 2)

  clock = 61_000 + 5 * 60_000 + 1
  await t.processor.handle('a.png', {}) // gagal ke-3 -> perlu dicek
  assert.equal(t.calls.import, 3)
  assert.equal(await t.exists('a.png'), false)
  assert.match(await fs.readFile(path.join(t.inbox, 'perlu-dicek', 'a.txt'), 'utf8'), /Gagal 3 kali: AI sedang sibuk/)
})

test('gagal memindah setelah tersimpan: AI tidak dipanggil lagi', async () => {
  const t = await setup({ importFile: () => saved })
  // selesai/ diganti file biasa, jadi rename ke dalamnya gagal (bukan ENOENT)
  await fs.rm(t.doneDir, { recursive: true })
  await fs.writeFile(t.doneDir, 'bukan folder')

  await assert.doesNotReject(t.processor.handle('a.png', {}))
  await t.processor.handle('a.png', {})
  assert.equal(t.calls.import, 1)
  assert.match(t.logs.join('\n'), /tersimpan/)

  await fs.rm(t.doneDir)
  await fs.mkdir(t.doneDir)
  await t.processor.handle('a.png', {})
  assert.equal(t.calls.import, 1)
  assert.equal(await t.exists('selesai', 'a.png'), true)
})

test('error tak terduga dari import tidak menghentikan proses', async () => {
  const t = await setup({
    importFile: () => {
      throw new TypeError('x is undefined')
    },
  })
  await assert.doesNotReject(t.processor.handle('a.png', {}))
  assert.match(t.logs.at(-1), /TypeError/)
  assert.equal(await t.exists('a.png'), true)
})

test('file hilang setelah tersimpan -> log menyebut sudah tersimpan', async () => {
  let inbox
  const t = await setup({
    importFile: async () => {
      await fs.rm(path.join(inbox, 'a.png'))
      return saved
    },
  })
  inbox = t.inbox
  await t.processor.handle('a.png', {})
  assert.match(t.logs.at(-1), /2 transaksi sudah tersimpan/)
})

test('prune melupakan file yang sudah tidak ada', async () => {
  let clock = 0
  const t = await setup({ importFile: busy, now: () => clock })
  await t.processor.handle('a.png', {}) // gagal ke-1
  t.processor.prune([]) // a.png hilang dari inbox
  await t.processor.handle('a.png', {}) // file baru bernama sama: langsung diproses lagi
  assert.equal(t.calls.import, 2)
})
