import assert from 'node:assert/strict'
import { test } from 'node:test'
import { HttpError } from './errors.js'
import { cleanBankScreenshot, importScreenshot, matchWallet, normalizeBankName, planInserts } from './bankImport.js'

const today = '2026-11-02'
const categories = [
  { id: 'c-makan', name: 'Makanan', type: 'expense' },
  { id: 'c-lain-out', name: 'Lainnya', type: 'expense' },
  { id: 'c-gaji', name: 'Gaji', type: 'income' },
  { id: 'c-lain-in', name: 'lainnya', type: 'income' }, // beda huruf, tetap dikenali
]
const wallets = [
  { id: 'w-bca', name: 'BCA' },
  { id: 'w-sea', name: 'SeaBank' },
]
const row = (over) => ({ date: '2026-11-01', amount: 25000, type: 'expense', description: 'Kopi', category_id: 'c-makan', ...over })
const clean = (transactions, cats = categories) =>
  cleanBankScreenshot({ bank: 'BCA', transactions, confidence: 0.9 }, { today, categories: cats })

// ---------- Dompet ----------

test('nama bank dinormalisasi', () => {
  assert.equal(normalizeBankName('Sea Bank'), 'seabank')
  assert.equal(normalizeBankName(' B.C.A '), 'bca')
  assert.equal(normalizeBankName(null), '')
})

test('dompet cocok walau beda spasi dan huruf', () => {
  assert.equal(matchWallet('sea bank', wallets).wallet.id, 'w-sea')
})

test('bank tidak dikenali -> reason menyebut nama bank', () => {
  assert.match(matchWallet('Jago', wallets).reason, /Jago/)
})

test('bank kosong -> reason', () => {
  assert.ok(matchWallet(null, wallets).reason)
})

test('lebih dari satu dompet cocok -> reason', () => {
  const result = matchWallet('BCA', [...wallets, { id: 'w2', name: 'B C A' }])
  assert.ok(result.reason)
  assert.equal(result.wallet, undefined)
})

// ---------- Output AI ----------

test('baris dengan nominal tidak valid dibuang dan dihitung', () => {
  const result = clean([row(), row({ amount: '25.000' }), row({ amount: 0 }), row({ amount: 1.5 }), row({ type: 'transfer' })])
  assert.equal(result.rows.length, 1)
  assert.equal(result.dropped, 4)
})

// Tanggal yang tidak jelas TIDAK diganti hari ini: itu menyimpan di tanggal salah dan
// membuat kunci duplikat berbeda saat screenshot yang sama diimpor besoknya.
test('tanggal kosong, tidak valid, atau masa depan -> baris dibuang', () => {
  const result = clean([row(), row({ date: null }), row({ date: '2026-02-30' }), row({ date: '2026-12-01' })])
  assert.equal(result.rows.length, 1)
  assert.equal(result.dropped, 3)
})

test('tanggal hari ini dan lampau tetap dipakai', () => {
  const result = clean([row({ date: today }), row({ date: '2025-12-28' })])
  assert.deepEqual(result.rows.map((r) => r.date), [today, '2025-12-28'])
})

test('keterangan dipotong 60 karakter', () => {
  assert.equal(clean([row({ description: 'x'.repeat(80) })]).rows[0].note.length, 60)
})

test('kategori asing atau beda jenis jadi Lainnya sesuai jenis', () => {
  assert.equal(clean([row({ category_id: 'asing' })]).rows[0].category_id, 'c-lain-out')
  assert.equal(clean([row({ type: 'income', category_id: 'c-makan' })]).rows[0].category_id, 'c-lain-in')
  assert.equal(clean([row({ type: 'income', category_id: 'c-gaji' })]).rows[0].category_id, 'c-gaji')
})

test('tanpa kategori Lainnya untuk jenis itu -> reason', () => {
  const cats = categories.filter((c) => c.id !== 'c-lain-in')
  assert.ok(clean([row({ type: 'income', category_id: null })], cats).reason)
})

test('maksimal 50 baris', () => {
  assert.equal(clean(Array.from({ length: 60 }, () => row())).rows.length, 50)
})

test('output bukan objek -> rows kosong', () => {
  const result = cleanBankScreenshot('rusak', { today, categories })
  assert.equal(result.rows.length, 0)
})

// ---------- Duplikat ----------

const kopi = { date: '2026-11-03', type: 'expense', amount: 25000, note: 'Kopi', category_id: 'c' }

test('screenshot pertama: semua disimpan', () => {
  const result = planInserts([kopi, kopi], [])
  assert.equal(result.toInsert.length, 2)
  assert.equal(result.skipped, 0)
})

test('screenshot sama masuk lagi: tidak ada yang disimpan', () => {
  const result = planInserts([kopi, kopi], [kopi, kopi])
  assert.equal(result.toInsert.length, 0)
  assert.equal(result.skipped, 2)
})

test('tumpang-tindih: hanya selisih', () => {
  const result = planInserts([kopi], [kopi, kopi])
  assert.equal(result.toInsert.length, 0)
  assert.equal(result.skipped, 1)
})

test('jenis atau tanggal berbeda bukan duplikat', () => {
  const result = planInserts([{ ...kopi, type: 'income' }, { ...kopi, date: '2026-11-04' }], [kopi])
  assert.equal(result.toInsert.length, 2)
})

test('amount string dari database tetap cocok', () => {
  assert.equal(planInserts([kopi], [{ ...kopi, amount: '25000' }]).toInsert.length, 0)
})

// ---------- Alur satu screenshot ----------

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)])
const lists = { wallets, categories }
const ocrText = 'BCA mobile - Transfer Berhasil Rp25.000 ke Kopi Kenangan'
const aiResult = (over) => ({ bank: 'BCA', transactions: [row(), row({ amount: 50000 })], confidence: 0.9, ...over })

// Store palsu (lihat importStores.js): merekam rentang yang dibaca dan setiap insert.
function fakeStore(existing = [], insertError = null) {
  const calls = { reads: [], inserts: [] }
  return {
    calls,
    findExisting: async (range) => {
      calls.reads.push(range)
      return existing
    },
    insert: async ({ walletId, rows }) => {
      calls.inserts.push({ walletId, rows })
      if (insertError) throw insertError
    },
  }
}

function fakeDeps(over = {}) {
  const calls = { parseText: 0, parseImage: 0 }
  return {
    calls,
    ocr: async () => ocrText,
    parseText: async () => {
      calls.parseText++
      return aiResult()
    },
    parseImage: async () => {
      calls.parseImage++
      return aiResult()
    },
    ...over,
  }
}

const run = ({ buffer = png, store = fakeStore(), deps = fakeDeps(), vision = 'false' } = {}) => {
  process.env.RECEIPT_VISION_FALLBACK = vision
  return importScreenshot({ buffer, store, lists, today, deps })
}

test('bukan gambar -> review', async () => {
  assert.equal((await run({ buffer: Buffer.from('halo') })).status, 'review')
})

test('lebih dari 4 MB -> review', async () => {
  const big = Buffer.concat([png, Buffer.alloc(4 * 1024 * 1024)])
  assert.equal((await run({ buffer: big })).status, 'review')
})

test('teks OCR pendek tanpa vision -> review', async () => {
  const deps = fakeDeps({ ocr: async () => 'abc' })
  assert.equal((await run({ deps })).status, 'review')
  assert.equal(deps.calls.parseText, 0)
})

test('OCR gagal dengan vision -> parseImage dipakai', async () => {
  const deps = fakeDeps({
    ocr: async () => {
      throw new Error('tesseract')
    },
  })
  const result = await run({ deps, vision: 'true' })
  assert.equal(deps.calls.parseImage, 1)
  assert.equal(result.status, 'saved')
})

test('AI 422 dari teks dengan vision -> coba gambar', async () => {
  const deps = fakeDeps()
  deps.parseText = async () => {
    throw new HttpError(422, 'tidak terbaca')
  }
  const result = await run({ deps, vision: 'true' })
  assert.equal(deps.calls.parseImage, 1)
  assert.equal(result.status, 'saved')
})

test('confidence rendah -> review', async () => {
  const store = fakeStore()
  const deps = fakeDeps({ parseText: async () => aiResult({ confidence: 0.4 }) })
  assert.equal((await run({ store, deps })).status, 'review')
  assert.equal(store.calls.inserts.length, 0)
})

test('bank tidak dikenali -> review', async () => {
  const store = fakeStore()
  const deps = fakeDeps({ parseText: async () => aiResult({ bank: 'Jago' }) })
  const result = await run({ store, deps })
  assert.match(result.reason, /Jago/)
  assert.equal(store.calls.inserts.length, 0)
})

test('baris baru disimpan dalam satu insert', async () => {
  const store = fakeStore()
  const result = await run({ store })
  assert.deepEqual(store.calls.reads, [{ walletId: 'w-bca', from: '2026-11-01', to: '2026-11-01' }])
  assert.equal(store.calls.inserts.length, 1)
  assert.equal(store.calls.inserts[0].walletId, 'w-bca')
  assert.equal(store.calls.inserts[0].rows.length, 2)
  for (const r of store.calls.inserts[0].rows) {
    assert.equal(r.wallet_id, undefined)
    assert.equal(r.source, undefined)
    assert.equal(r.note, 'Kopi')
    assert.equal(r.category_id, 'c-makan')
  }
  assert.deepEqual(result, { status: 'saved', wallet: 'BCA', inserted: 2, skipped: 0, dropped: 0, expense: 75000, income: 0 })
})

test('semua sudah ada -> saved tanpa insert', async () => {
  const existing = [
    { date: '2026-11-01', type: 'expense', amount: 25000 },
    { date: '2026-11-01', type: 'expense', amount: 50000 },
  ]
  const store = fakeStore(existing)
  const result = await run({ store })
  assert.equal(result.inserted, 0)
  assert.equal(result.skipped, 2)
  assert.equal(store.calls.inserts.length, 0)
})

test('total hanya menghitung baris yang baru disimpan, per jenis', async () => {
  const transactions = [row(), row({ amount: 50000 }), row({ amount: 1000000, type: 'income', category_id: 'c-gaji' })]
  const deps = fakeDeps({ parseText: async () => aiResult({ transactions }) })
  const store = fakeStore([{ date: '2026-11-01', type: 'expense', amount: 25000 }])
  const result = await run({ store, deps })
  assert.equal(result.inserted, 2)
  assert.equal(result.skipped, 1)
  assert.equal(result.expense, 50000)
  assert.equal(result.income, 1000000)
})

test('semua duplikat -> total nol', async () => {
  const store = fakeStore([
    { date: '2026-11-01', type: 'expense', amount: 25000 },
    { date: '2026-11-01', type: 'expense', amount: 50000 },
  ])
  const result = await run({ store })
  assert.equal(result.expense, 0)
  assert.equal(result.income, 0)
})

test('AI sibuk -> error dilempar', async () => {
  const busy = new HttpError(503, 'AI sedang sibuk')
  busy.retryable = true
  const deps = fakeDeps({
    parseText: async () => {
      throw busy
    },
  })
  await assert.rejects(run({ deps }), { status: 503 })
})

test('insert gagal -> error dilempar', async () => {
  const failed = new HttpError(502, 'Gagal menyimpan transaksi.')
  await assert.rejects(run({ store: fakeStore([], failed) }), failed)
})
