import 'server-only'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

// Client Supabase atas nama satu user: header Authorization berisi token user itu,
// jadi RLS di database berlaku (user hanya melihat datanya sendiri).
// Dibuat per request, tidak dibagi antar user. Secret key tidak dipakai.
export function createUserClient(token) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    // Node 20 belum punya WebSocket bawaan; supabase-js membutuhkannya saat dibuat.
    realtime: { transport: ws },
  })
}
