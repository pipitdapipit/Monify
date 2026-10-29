import { USE_MOCK } from '@/lib/api/client'
import * as mock from '@/lib/api/mock/mockHandlers'
import * as db from '@/lib/api/supabaseHandlers'

// Transaksi: { id, type: 'income'|'expense', amount, category_id, wallet_id, date: 'YYYY-MM-DD', note }
// amount selalu bilangan bulat rupiah.

// filters: { from, to, wallet_id, category_id, limit } — semuanya opsional
export function getTransactions(filters = {}) {
  if (USE_MOCK) return mock.getTransactions(filters)
  return db.getTransactions(filters)
}

// data boleh berisi source: 'manual' | 'ai_text' | 'ai_receipt'
export function createTransaction(data) {
  if (USE_MOCK) return mock.createTransaction(data)
  return db.createTransaction(data)
}

export function updateTransaction(id, data) {
  if (USE_MOCK) return mock.updateTransaction(id, data)
  return db.updateTransaction(id, data)
}

export function deleteTransaction(id) {
  if (USE_MOCK) return mock.deleteTransaction(id)
  return db.deleteTransaction(id)
}
