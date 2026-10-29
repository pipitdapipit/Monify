import { USE_MOCK } from '@/lib/api/client'
import * as mock from '@/lib/api/mock/mockHandlers'
import * as db from '@/lib/api/supabaseHandlers'

// Mode mock -> data palsu. Selain itu -> Supabase Auth.
// register mengembalikan { token, user }, atau { needsConfirmation: true }
// kalau Supabase meminta konfirmasi email dulu.

export function register({ name, email, password }) {
  if (USE_MOCK) return mock.register({ name, email, password })
  return db.register({ name, email, password })
}

export function login({ email, password }) {
  if (USE_MOCK) return mock.login({ email, password })
  return db.login({ email, password })
}

export function getMe() {
  if (USE_MOCK) return mock.getMe()
  return db.getMe()
}

export async function logout() {
  if (USE_MOCK) return
  await db.logout()
}
