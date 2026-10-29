import 'server-only'
import { HttpError } from './errors.js'
import { createUserClient } from './supabase.js'

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
