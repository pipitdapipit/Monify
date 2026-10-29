import { USE_MOCK } from '@/lib/api/client'
import * as mock from '@/lib/api/mock/mockHandlers'
import * as db from '@/lib/api/supabaseHandlers'

// -> { payday_date (1-31) }
export function getSettings() {
  if (USE_MOCK) return mock.getSettings()
  return db.getSettings()
}

export function updateSettings(data) {
  if (USE_MOCK) return mock.updateSettings(data)
  return db.updateSettings(data)
}
