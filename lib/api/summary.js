import { USE_MOCK } from '@/lib/api/client'
import * as mock from '@/lib/api/mock/mockHandlers'
import * as db from '@/lib/api/supabaseHandlers'

// Dihitung oleh fungsi SQL di Supabase (rpc), bukan oleh front-end.

// -> { amount, days_left, upcoming_bills_total, cycle_start, cycle_end }
export function getSafeToSpend() {
  if (USE_MOCK) return mock.getSafeToSpend()
  return db.getSafeToSpend()
}

// -> { total_income, total_expense,
//      by_category: [{ category_id, name, color, total }],
//      daily: [{ date, income, expense }] }
export function getOverview({ from, to }) {
  if (USE_MOCK) return mock.getOverview({ from, to })
  return db.getOverview({ from, to })
}
