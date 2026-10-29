import 'server-only'
import { HttpError } from './errors.js'
import { llmTransactionSchema } from './schemas.js'
import { todayJakarta } from './today.js'
import { parseTransactionText } from './ai.js'
import { validDateOrToday } from './receipt.js'

// Bersihkan & validasi keluaran model. Kembalikan null kalau bentuknya rusak.
// id kategori / dompet yang bukan milik user, atau kategori yang jenisnya tidak
// cocok dengan type, dijadikan null.
export function cleanTransaction(raw, text, { today, categories, wallets }) {
  const parsed = llmTransactionSchema.safeParse(raw)
  if (!parsed.success) return null
  const r = parsed.data

  const category = categories.find((c) => c.id === r.category_id)
  // Tanpa nominal, hasilnya pasti kurang yakin: batasi confidence supaya layar konfirmasi menandainya.
  const maxConfidence = r.amount === 0 ? 0.3 : 1

  return {
    amount: r.amount,
    type: r.type,
    category_id: category && category.type === r.type ? category.id : null,
    wallet_id: wallets.some((w) => w.id === r.wallet_id) ? r.wallet_id : null,
    date: validDateOrToday(r.date, today),
    note: r.note || text.slice(0, 120),
    confidence: Math.min(maxConfidence, Math.max(0, r.confidence)),
  }
}

// Kalimat -> data transaksi. lists = { wallets, categories } milik user.
export async function parseTransaction({ text, lists }) {
  const ctx = { today: todayJakarta(), categories: lists.categories, wallets: lists.wallets }
  const result = cleanTransaction(await parseTransactionText({ text, ...ctx }), text, ctx)
  if (!result) {
    throw new HttpError(422, 'Transaksi tidak bisa dipahami. Coba tulis dengan nominal, mis. "makan siang 25rb".')
  }
  return result
}
