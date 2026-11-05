import { ApiError, USE_MOCK } from '@/lib/api/client'
import * as db from '@/lib/api/supabaseHandlers'
import { generateApiKey } from '@/utils/apiKey'

// Personal API key untuk iPhone Shortcut: { id, name, prefix, created_at, last_used_at }
// Hanya ada versi Supabase (endpoint import butuh database sungguhan).

function requireSupabase() {
  if (USE_MOCK) throw new ApiError('Fitur ini hanya tersedia dengan Supabase.', 0)
}

export function getApiKeys() {
  requireSupabase()
  return db.getApiKeys()
}

// -> { key, item }. key asli hanya ada di sini: tampilkan sekali, lalu lupakan.
export async function createApiKey(name) {
  requireSupabase()
  const trimmed = name.trim()
  if (!trimmed) throw new ApiError('Nama key wajib diisi.', 422)
  if (trimmed.length > 40) throw new ApiError('Nama key maksimal 40 karakter.', 422)
  const { key, prefix, hash } = await generateApiKey()
  const item = await db.createApiKey({ name: trimmed, prefix, key_hash: hash })
  return { key, item }
}

export function deleteApiKey(id) {
  requireSupabase()
  return db.deleteApiKey(id)
}
