import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cleanBankScreenshot, matchWallet, normalizeBankName } from './bankImport.js'

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

test('tanggal masa depan jadi hari ini', () => {
  assert.equal(clean([row({ date: '2026-12-01' })]).rows[0].date, today)
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
