import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cleanReceipt, parseReceipt, validDateOrToday } from './receipt.js'

const today = '2026-10-28'

test('tanggal yang tidak ada di kalender diganti hari ini', () => {
  assert.equal(validDateOrToday('2026-02-30', today), today)
})

test('tanggal masa depan diganti hari ini', () => {
  assert.equal(validDateOrToday('2026-11-01', today), today)
  assert.equal(validDateOrToday('2026-10-01', today), '2026-10-01')
})

test('category_id yang bukan milik user dijadikan null', () => {
  const raw = { merchant: 'Toko', date: today, total: 25000, items: [], category_id: 'asing', wallet_id: null, confidence: 0.9 }
  const result = cleanReceipt(raw, { today, categories: [{ id: 'c1' }], wallets: [] })
  assert.equal(result.suggested_category_id, null)
  assert.equal(result.total, 25000)
})

// JPEG rusak: lolos cek magic bytes, tapi OCR gagal (melempar error).
const brokenJpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('bukan jpeg sungguhan '.repeat(5))])
const jpg = { ext: '.jpg', mime: 'image/jpeg' }
const lists = { wallets: [], categories: [] }

test('OCR gagal tanpa vision fallback -> 422', async () => {
  process.env.RECEIPT_VISION_FALLBACK = 'false'
  await assert.rejects(parseReceipt({ buffer: brokenJpeg, type: jpg, lists }), { status: 422 })
})

test('OCR gagal dengan vision fallback -> lanjut ke jalur gambar', async () => {
  process.env.RECEIPT_VISION_FALLBACK = 'true'
  // Tanpa AI_API_KEY, jalur gambar berhenti di 503 "belum dikonfigurasi":
  // itu bukti fallback benar-benar dicoba (bukan 422 dari OCR).
  const key = process.env.AI_API_KEY
  delete process.env.AI_API_KEY
  try {
    await assert.rejects(parseReceipt({ buffer: brokenJpeg, type: jpg, lists }), { status: 503 })
  } finally {
    if (key !== undefined) process.env.AI_API_KEY = key
    delete process.env.RECEIPT_VISION_FALLBACK
  }
})
