import 'server-only'
// Cek jenis gambar dari byte pertama file (magic bytes), bukan dari nama / header
// yang dikirim user karena itu mudah dipalsukan.
// Mengembalikan { mime, ext } atau null kalau bukan JPG / PNG / WEBP.
export function detectImageType(buf) {
  if (buf.length < 12) return null

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: '.jpg' }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (png.every((byte, i) => buf[i] === byte)) return { mime: 'image/png', ext: '.png' }

  // WEBP: "RIFF" ???? "WEBP"
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { mime: 'image/webp', ext: '.webp' }
  }
  return null
}
