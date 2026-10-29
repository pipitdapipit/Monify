import 'server-only'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

// OCR gambar -> teks biasa memakai LiteParse (Tesseract bawaan, tanpa ImageMagick).
// Dibuat sekali dan dipakai ulang, karena membuat parser itu mahal.
// Di-import saat dipakai (bukan di atas file): LiteParse memuat modul native saat di-import,
// jadi kalau binary-nya gagal dimuat (mis. di Vercel), hanya OCR yang gagal, bukan seluruh route.
let parser
async function getParser() {
  const { LiteParse } = await import('@llamaindex/liteparse')
  parser ??= new LiteParse({
    ocrEnabled: true,
    ocrLanguage: process.env.OCR_LANGUAGE || 'eng',
    outputFormat: 'text',
    quiet: true, // jangan cetak progres ke log
  })
  return parser
}

// ext: '.jpg' | '.png' | '.webp' (dari pengecekan magic bytes, bukan dari user)
export async function ocrImage(buffer, ext) {
  // File sementara dengan nama acak. Selalu dihapus di finally, berhasil atau gagal.
  const file = path.join(os.tmpdir(), `monify-receipt-${crypto.randomUUID()}${ext}`)
  try {
    await fs.writeFile(file, buffer)
    const result = await (await getParser()).parse(file)
    return (result.text || '').trim()
  } finally {
    await fs.rm(file, { force: true })
  }
}
