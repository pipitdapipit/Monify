import { request, USE_MOCK } from '@/lib/api/client'
import * as mock from '@/lib/api/mock/mockHandlers'

// AI dijalankan di server (app/api/ai). Front-end hanya mengirim teks/gambar
// dan menampilkan hasilnya untuk dikonfirmasi user.

// -> { amount, type, category_id, wallet_id, date, note, confidence (0-1) }
export function parseTransaction(text) {
  if (USE_MOCK) return mock.parseTransaction(text)
  return request('/api/ai/parse-transaction', { method: 'POST', body: { text } })
}

// -> { merchant, date, total, items: [{ name, price }], suggested_category_id }
export function parseReceipt(file) {
  if (USE_MOCK) return mock.parseReceipt(file)
  const form = new FormData()
  form.append('image', file)
  return request('/api/ai/parse-receipt', { method: 'POST', body: form })
}
