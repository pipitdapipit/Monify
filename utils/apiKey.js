// Personal API key untuk iPhone Shortcut: "mnf_" + 32 byte acak (base64url).
// Dibuat di browser; yang dikirim ke database hanya hash SHA-256 dan prefix-nya.
// Web Crypto, jadi jalan di browser maupun Node (test).

function base64url(bytes) {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function hex(buffer) {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('')
}

// -> { key, prefix, hash }. key hanya boleh ditampilkan sekali ke user.
export async function generateApiKey() {
  const key = `mnf_${base64url(crypto.getRandomValues(new Uint8Array(32)))}`
  const hash = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)))
  return { key, prefix: key.slice(0, 12), hash }
}
