// Satu tempat untuk semua panggilan ke backend.
// File lain di folder api/ memanggil request() ini, atau versi mock-nya.

import { supabase } from '@/lib/api/supabase'

// AI dipanggil lewat route /api/ai/* di app ini (data biasa langsung ke Supabase lewat supabaseHandlers.js)
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

const TOKEN_KEY = 'monify_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

// AuthContext mendaftarkan fungsi logout di sini,
// supaya kalau server membalas 401 (token kedaluwarsa) user otomatis keluar.
let onUnauthorized = null
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

// Error khusus supaya halaman bisa tahu status HTTP-nya.
export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

// Ubah { from: '2026-10-01', wallet_id: '' } jadi "?from=2026-10-01"
// (nilai kosong dilewati).
function buildQuery(params) {
  if (!params) return ''
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.append(key, value)
    }
  })
  const text = search.toString()
  return text ? `?${text}` : ''
}

// Token untuk dikirim ke backend. Dengan Supabase, token diambil dari sesi
// (diperbarui otomatis oleh supabase-js saat hampir kedaluwarsa).
async function currentToken() {
  if (USE_MOCK || !supabase) return getToken()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export async function request(path, { method = 'GET', body, query } = {}) {
  const headers = {}
  const token = await currentToken()
  if (token) headers.Authorization = `Bearer ${token}`

  // FormData (upload gambar) dikirim apa adanya; selain itu kirim JSON.
  let payload
  if (body instanceof FormData) {
    payload = body
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let res
  try {
    res = await fetch(path + buildQuery(query), { method, headers, body: payload })
  } catch {
    throw new ApiError('Tidak bisa terhubung ke server. Periksa koneksi internet.', 0)
  }

  // 204 No Content tidak punya body.
  const data = res.status === 204 ? null : await res.json().catch(() => null)

  if (res.status === 401 && onUnauthorized) onUnauthorized()

  if (!res.ok) {
    // Backend Monify mengirim { error: "..." }
    throw new ApiError(data?.error || data?.message || `Terjadi kesalahan (${res.status}).`, res.status)
  }
  return data
}
