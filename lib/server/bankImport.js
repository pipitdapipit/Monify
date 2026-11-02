import 'server-only'
// Import screenshot bank / e-wallet (bukti transfer atau mutasi) menjadi transaksi.
// Dipakai skrip scripts/watch-inbox.mjs. File ini tidak menyentuh filesystem,
// supaya nanti bisa dipanggil juga dari route API.
import { llmBankRowSchema, llmBankScreenshotSchema } from './schemas.js'
import { validDateOrToday } from './receipt.js'

const MAX_ROWS = 50
const MAX_NOTE = 60

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

// Bersihkan keluaran model (tidak tepercaya). Baris rusak dibuang dan dihitung di dropped.
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
    const category = categories.find((c) => c.id === r.category_id && c.type === r.type) || fallback(r.type)
    if (!category) {
      const jenis = r.type === 'income' ? 'pemasukan' : 'pengeluaran'
      return { reason: `Kategori "Lainnya" untuk ${jenis} tidak ada di akun Monify` }
    }
    rows.push({
      date: validDateOrToday(r.date, today),
      amount: r.amount,
      type: r.type,
      note: r.description.slice(0, MAX_NOTE),
      category_id: category.id,
    })
  }
  return { bank, rows, dropped, confidence: Math.min(1, Math.max(0, confidence)) }
}
