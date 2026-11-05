import 'server-only'
import { createHash } from 'node:crypto'
import { HttpError } from './errors.js'
import { createAnonClient, createUserClient } from './supabase.js'

function json(body, status = 200) {
  return Response.json(body, { status })
}

// Pembungkus route AI: wajib login, rate limit per user, dan penanganan error terpusat.
// Token (Authorization: Bearer ...) diperiksa ke Supabase Auth, jadi token palsu /
// kedaluwarsa / sudah logout ditolak. handler menerima (request, { user, supabase })
// dan me-return objek yang dikirim sebagai JSON.
export function withAuth(handler, { limiter, limitMessage } = {}) {
  return async function route(request) {
    try {
      const [scheme, token] = (request.headers.get('authorization') || '').split(' ')
      if (scheme !== 'Bearer' || !token) return json({ error: 'Harus login dulu.' }, 401)

      const supabase = createUserClient(token)
      const { data, error } = await supabase.auth.getUser(token)
      if (error || !data.user) {
        return json({ error: 'Sesi tidak valid atau sudah berakhir. Silakan masuk lagi.' }, 401)
      }

      // Pembatas per user (bukan per IP), jadi dicek SETELAH login
      if (limiter && !limiter(data.user.id)) return json({ error: limitMessage }, 429)

      return json(await handler(request, { user: data.user, supabase }))
    } catch (err) {
      // Hanya pesan aman (HttpError) yang sampai ke user; error lain dicatat tanpa isi request.
      if (err instanceof HttpError) return json({ error: err.message }, err.status)
      console.error('Unhandled error:', err.name, err.message)
      return json({ error: 'Terjadi kesalahan di server.' }, 500)
    }
  }
}

const INVALID_KEY = 'API key tidak valid. Buat key baru di Pengaturan Monify.'

// Respons error untuk iPhone Shortcut: Shortcut hanya menampilkan field "message".
function keyError(message, status) {
  return json({ error: message, message }, status)
}

// Pembungkus route untuk personal API key (Authorization: Bearer mnf_...).
// Key diperiksa oleh fungsi SQL api_key_lists (key salah / dihapus -> errcode 28000),
// yang sekaligus mengembalikan dompet & kategori pemilik key. Tanpa secret key.
// handler menerima (request, { key, supabase, lists }) dan me-return objek JSON.
export function withApiKey(handler, { limiter, limitMessage, createClient = createAnonClient } = {}) {
  return async function route(request) {
    try {
      // Key dari Shortcut sering ter-paste dengan spasi / newline, dan "bearer" kecil
      const [scheme = '', key = ''] = (request.headers.get('authorization') || '').trim().split(/\s+/)
      if (scheme.toLowerCase() !== 'bearer' || !key.startsWith('mnf_')) return keyError(INVALID_KEY, 401)

      const supabase = createClient()
      const { data: lists, error } = await supabase.rpc('api_key_lists', { p_key: key })
      if (error?.code === '28000') return keyError(INVALID_KEY, 401)
      if (error) return keyError('Gagal mengambil data dompet / kategori.', 502)

      // Per key; yang disimpan limiter hanya hash-nya, bukan key asli
      if (limiter && !limiter(createHash('sha256').update(key).digest('hex'))) {
        return keyError(limitMessage, 429)
      }

      return json(await handler(request, { key, supabase, lists }))
    } catch (err) {
      if (err instanceof HttpError) return keyError(err.message, err.status)
      console.error('Unhandled error:', err.name)
      return keyError('Terjadi kesalahan di server.', 500)
    }
  }
}
