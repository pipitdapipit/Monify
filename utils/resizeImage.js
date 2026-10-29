// Kecilkan foto di browser sebelum upload (batas body server 4,5 MB).
// Sisi terpanjang maks maxSide px, disimpan sebagai JPEG.
export async function resizeImage(file, { maxSide = 1600, quality = 0.85 } = {}) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  // Latar putih: PNG / WEBP transparan tidak jadi hitam saat diubah ke JPEG
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal memproses gambar.'))), 'image/jpeg', quality),
  )
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], name, { type: 'image/jpeg' })
}
