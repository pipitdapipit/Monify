// Folder inbox screenshot bank: setiap screenshot yang ditaruh di folder otomatis
// dibaca (OCR + AI) dan transaksinya disimpan ke Monify atas nama akunmu.
//
//   npm run watch
//
// Perlu di .env.local: AI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
// MONIFY_EMAIL, MONIFY_PASSWORD. Opsional: MONIFY_INBOX (lokasi folder).
//
// Hasil: file pindah ke selesai/ (tersimpan) atau perlu-dicek/ (+ <nama>.txt berisi alasan).
// Teks OCR, nominal, dan keterangan transaksi tidak pernah dicetak ke log.
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { importScreenshot } from '../lib/server/bankImport.js'
import { HttpError } from '../lib/server/errors.js'
import { loadUserLists } from '../lib/server/userData.js'
import { isStable, listInbox } from './inboxFiles.mjs'
import { createProcessor } from './inboxProcessor.mjs'

const POLL_MS = 5_000
const REQUIRED_ENV = [
  'AI_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'MONIFY_EMAIL',
  'MONIFY_PASSWORD',
]

const missing = REQUIRED_ENV.filter((name) => !process.env[name])
if (missing.length > 0) {
  console.error(`Isi dulu di .env.local: ${missing.join(', ')}`)
  process.exit(1)
}

const inbox = process.env.MONIFY_INBOX || path.join(os.homedir(), 'Pictures', 'Monify Inbox')
const doneDir = path.join(inbox, 'selesai')
const reviewDir = path.join(inbox, 'perlu-dicek')

// Login sekali; autoRefreshToken menjaga sesi tetap hidup selama skrip berjalan.
// Semua query berjalan sebagai user ini, jadi RLS berlaku. Tidak memakai secret key.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
  realtime: { transport: ws },
})
const { error: loginError } = await supabase.auth.signInWithPassword({
  email: process.env.MONIFY_EMAIL,
  password: process.env.MONIFY_PASSWORD,
})
if (loginError) {
  console.error('Login gagal: periksa MONIFY_EMAIL / MONIFY_PASSWORD')
  process.exit(1)
}

await fs.mkdir(doneDir, { recursive: true })
await fs.mkdir(reviewDir, { recursive: true })
console.log(`Memantau ${inbox}`)
console.log(`Login sebagai ${process.env.MONIFY_EMAIL}. Tekan Ctrl+C untuk berhenti.\n`)

const sizes = new Map() // nama -> ukuran di pengecekan sebelumnya
const processor = createProcessor({
  inbox,
  doneDir,
  reviewDir,
  importFile: (buffer, lists) => importScreenshot({ buffer, supabase, lists }),
})

async function tick() {
  const names = await listInbox(inbox)
  for (const name of sizes.keys()) if (!names.includes(name)) sizes.delete(name)
  processor.prune(names)

  // Hanya file yang ukurannya sudah stabil (selesai ditulis) yang diproses
  const ready = []
  for (const name of names) {
    try {
      const { stable, size } = await isStable(path.join(inbox, name), sizes.get(name))
      sizes.set(name, size)
      if (stable) ready.push(name)
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
  }
  if (ready.length === 0) return

  // Dimuat ulang tiap putaran, supaya dompet / kategori baru langsung terpakai
  const lists = await loadUserLists(supabase)
  // handle() tidak melempar error: satu file bermasalah tidak menghentikan file lain
  for (const name of ready) await processor.handle(name, lists)
}

// setTimeout setelah putaran selesai (bukan setInterval), supaya putaran tidak tumpang-tindih.
async function loop() {
  try {
    await tick()
  } catch (err) {
    // Mis. gagal membaca folder atau mengambil dompet: dicoba lagi di putaran berikutnya
    console.error(`Putaran gagal: ${err instanceof HttpError ? err.message : err.code || 'kesalahan tidak terduga'}`)
  }
  setTimeout(loop, POLL_MS)
}

loop()
