import 'server-only'
import { z } from 'zod'

// Batas atas uang, supaya tetap aman sebagai integer JavaScript dan masuk akal untuk struk.
const MAX_RUPIAH = 999_999_999_999

// Body request POST /ai/parse-transaction: { text } maksimal 300 karakter.
export const parseTransactionBody = z.object({
  text: z.string().trim().min(1).max(300),
})

// Keluaran model untuk kalimat bebas (tidak tepercaya, jadi divalidasi).
// amount 0 diperbolehkan: artinya "nominal tidak ditemukan", user mengisinya di layar konfirmasi.
export const llmTransactionSchema = z.object({
  amount: z.number().int().min(0).max(MAX_RUPIAH),
  type: z.enum(['income', 'expense']),
  category_id: z.string().nullable().catch(null),
  wallet_id: z.string().nullable().catch(null),
  date: z.string().nullable().catch(null),
  note: z.string().trim().max(120).catch(''),
  confidence: z.number().catch(0.3),
})

// Isi item struk. Item yang rusak dibuang satu per satu (tidak menggagalkan seluruh struk).
export const receiptItemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  qty: z.number().int().positive().max(999).catch(1),
  price: z.number().int().min(0).max(MAX_RUPIAH),
})

// Bentuk yang kita TERIMA dari model. Dianggap tidak tepercaya:
// total wajib bilangan bulat > 0, sisanya diperbaiki ke nilai aman kalau rusak.
export const llmReceiptSchema = z.object({
  merchant: z.string().trim().max(80).nullable().catch(null),
  date: z.string().nullable().catch(null),
  total: z.number().int().positive().max(MAX_RUPIAH),
  items: z.array(z.unknown()).catch([]),
  category_id: z.string().nullable().catch(null),
  wallet_id: z.string().nullable().catch(null),
  confidence: z.number().catch(0.3),
})
