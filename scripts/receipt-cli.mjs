// Tes lokal: gambar struk -> OCR (LiteParse) -> AI -> JSON akhir.
//
//   npm run test:receipt -- path/ke/struk.jpg
//
// Perlu AI_API_KEY di .env.local. Dompet & kategori memakai contoh bawaan di bawah.
// Mau memakai dompet & kategori akun sungguhan? Isi TEST_ACCESS_TOKEN di .env.local
// dengan access token login (jangan commit) dan skrip akan memuatnya dari Supabase.
//
// CATATAN: skrip ini MENCETAK teks OCR ke terminalmu (khusus untuk debugging lokal).
// Server (lib/server/) tidak pernah mencatat teks OCR.
import fs from 'node:fs'
import { performance } from 'node:perf_hooks'
import { parseReceipt } from '../lib/server/receipt.js'
import { createUserClient } from '../lib/server/supabase.js'
import { loadUserLists } from '../lib/server/userData.js'
import { detectImageType } from '../lib/server/fileType.js'

const file = process.argv[2]
if (!file) {
  console.error('Pemakaian: npm run test:receipt -- <path-gambar>')
  process.exit(1)
}

const buffer = fs.readFileSync(file)
const type = detectImageType(buffer)
if (!type) {
  console.error('Bukan gambar JPG / PNG / WEBP yang valid.')
  process.exit(1)
}

// Contoh dompet & kategori (id palsu)
let lists = {
  wallets: [
    { id: 'w-tunai', name: 'Tunai' },
    { id: 'w-bca', name: 'BCA' },
    { id: 'w-gopay', name: 'GoPay' },
    { id: 'w-ovo', name: 'OVO' },
  ],
  categories: ['Makanan', 'Transport', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Lainnya'].map(
    (name) => ({ id: `c-${name.toLowerCase()}`, name, type: 'expense' }),
  ),
}
if (process.env.TEST_ACCESS_TOKEN) {
  lists = await loadUserLists(createUserClient(process.env.TEST_ACCESS_TOKEN))
  console.log('(memakai dompet & kategori dari akun)')
}

const start = performance.now()
let ocrDone
try {
  const result = await parseReceipt({
    buffer,
    type,
    lists,
    onOcr(text) {
      ocrDone = performance.now()
      console.log(`--- Teks OCR (500 karakter pertama dari ${text.length}) ---`)
      console.log(text.slice(0, 500))
    },
  })
  console.log('\n--- Hasil akhir ---')
  console.log(JSON.stringify(result, null, 2))
} catch (err) {
  console.error('\nGAGAL:', err.status ? `[${err.status}]` : '', err.message)
}
const end = performance.now()
if (ocrDone) console.log(`\nWaktu: OCR ${((ocrDone - start) / 1000).toFixed(1)} dtk, AI ${((end - ocrDone) / 1000).toFixed(1)} dtk`)
console.log(`Total: ${((end - start) / 1000).toFixed(1)} dtk`)
