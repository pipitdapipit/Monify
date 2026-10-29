import { USE_MOCK } from '@/lib/api/client'
import * as mock from '@/lib/api/mock/mockHandlers'
import * as db from '@/lib/api/supabaseHandlers'

// Kategori: { id, name, type: 'income'|'expense', icon, color }
export function getCategories() {
  if (USE_MOCK) return mock.getCategories()
  return db.getCategories()
}
