import { createClient } from '@supabase/supabase-js'

// Hanya URL dan publishable key yang dipakai di browser. Keamanan data dijaga
// oleh RLS di database, bukan oleh key ini. JANGAN pernah taruh secret key di sini.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

// null kalau .env belum diisi (mis. saat mode mock), dan saat prerender di server:
// client ini hanya untuk browser (sesi di localStorage), semua panggilan terjadi di efek / handler.
export const supabase = typeof window !== 'undefined' && url && key ? createClient(url, key) : null
