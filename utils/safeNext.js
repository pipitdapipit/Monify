// Tujuan setelah login (?next=...). Hanya path internal yang diterima.
// Dicek dengan mengurai URL-nya (bukan cek awalan), karena browser membaca "//host",
// "/\host", dan "/<tab>/host" (tab / CR / LF dibuang) sebagai alamat situs lain.
const BASE = 'http://monify.invalid'

export function safeNext(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/'
  try {
    const url = new URL(value, BASE)
    if (url.origin !== BASE) return '/'
    return url.pathname + url.search + url.hash
  } catch {
    return '/'
  }
}
