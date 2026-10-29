import 'server-only'
import { HttpError } from './errors.js'
import { llmReceiptSchema, receiptItemSchema } from './schemas.js'
import { todayJakarta } from './today.js'
import { parseReceiptImage, parseReceiptText } from './ai.js'
import { ocrImage } from './ocr.js'

const MIN_OCR_CHARS = 20
const LOW_CONFIDENCE = 0.5
const UNREADABLE = 'Struk tidak terbaca, coba foto lebih jelas'

// Tanggal harus yyyy-mm-dd, benar-benar ada di kalender, dan tidak di masa depan.
// Kalau tidak, pakai hari ini.
export function validDateOrToday(value, today) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
  if (!match) return today
  const [, y, m, d] = match.map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const exists = date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
  return exists && value <= today ? value : today
}

// Bersihkan & validasi keluaran model. Kembalikan null kalau total tidak valid.
// id kategori / dompet yang bukan milik user dijadikan null.
export function cleanReceipt(raw, { today, categories, wallets }) {
  const parsed = llmReceiptSchema.safeParse(raw)
  if (!parsed.success) return null
  const r = parsed.data

  const items = r.items
    .map((item) => receiptItemSchema.safeParse(item))
    .filter((result) => result.success)
    .map((result) => result.data)
    .slice(0, 50)

  return {
    merchant: r.merchant || '',
    date: validDateOrToday(r.date, today),
    total: r.total,
    items,
    suggested_category_id: categories.some((c) => c.id === r.category_id) ? r.category_id : null,
    wallet_id: wallets.some((w) => w.id === r.wallet_id) ? r.wallet_id : null,
    confidence: Math.min(1, Math.max(0, r.confidence)),
  }
}

// Alur lengkap: gambar -> OCR -> AI -> validasi.
// lists = { wallets, categories } milik user. onOcr (opsional) menerima teks OCR, untuk skrip tes.
export async function parseReceipt({ buffer, type, lists, onOcr }) {
  const today = todayJakarta()
  // Struk adalah pengeluaran, jadi cukup kirim kategori pengeluaran.
  const ctx = { today, categories: lists.categories.filter((c) => c.type === 'expense'), wallets: lists.wallets }
  const visionFallback = process.env.RECEIPT_VISION_FALLBACK === 'true'

  let text
  try {
    text = await ocrImage(buffer, type.ext)
  } catch {
    // Pesan error OCR tidak diteruskan (bisa memuat path file di server).
    // Dengan vision fallback, OCR yang gagal total tetap dicoba lewat gambar.
    if (!visionFallback) throw new HttpError(422, UNREADABLE)
    text = ''
  }
  onOcr?.(text)

  const tooShort = text.length < MIN_OCR_CHARS
  if (tooShort && !visionFallback) throw new HttpError(422, UNREADABLE)

  // Jalur utama: kirim teks OCR ke AI
  let result = null
  if (!tooShort) {
    try {
      result = cleanReceipt(await parseReceiptText({ text, ...ctx }), ctx)
    } catch (err) {
      // Model gagal membaca (422) boleh dicoba lewat gambar; error lain diteruskan
      if (!(err instanceof HttpError) || err.status !== 422) throw err
    }
  }

  // Cadangan (default mati): OCR buruk atau AI kurang yakin -> kirim gambarnya
  if (visionFallback && (!result || result.confidence < LOW_CONFIDENCE)) {
    try {
      const viaImage = cleanReceipt(
        await parseReceiptImage({ image: { buffer, mime: type.mime }, ...ctx }),
        ctx,
      )
      if (viaImage && (!result || viaImage.confidence > result.confidence)) result = viaImage
    } catch (err) {
      if (!(err instanceof HttpError) || err.status !== 422 || !result) throw err
    }
  }

  if (!result) throw new HttpError(422, 'Total belanja tidak ditemukan. Coba foto struk yang lebih jelas.')

  // 200 karakter pertama saja, untuk debugging. Teks lengkap tidak pernah dicatat.
  return { ...result, raw_text_preview: text.slice(0, 200) }
}
