// Urusan file untuk folder inbox (dipakai scripts/watch-inbox.mjs).
// Aturan: file tidak pernah dihapus atau ditimpa, hanya dipindah.
import fs from 'node:fs/promises'
import path from 'node:path'

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp']

export function isInboxImage(name) {
  return IMAGE_EXTS.includes(path.extname(name).toLowerCase())
}

// Nama gambar di folder utama saja (subfolder diabaikan), urut nama.
export async function listInbox(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  return entries
    .filter((e) => e.isFile() && isInboxImage(e.name))
    .map((e) => e.name)
    .sort()
}

async function exists(file) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

// "bca.png" -> "bca (2).png" kalau bca.png atau bca.txt sudah ada di dir,
// supaya gambar dan file alasannya selalu berpasangan dengan nama yang sama.
export async function uniqueName(dir, name) {
  const ext = path.extname(name)
  const base = path.basename(name, ext)
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base} (${n})`
    const taken = (await exists(path.join(dir, candidate + ext))) || (await exists(path.join(dir, `${candidate}.txt`)))
    if (!taken) return candidate + ext
  }
}

// Pindahkan file ke toDir. Kalau reason ada, tulis <nama>.txt berisi alasannya.
// Mengembalikan nama akhir di toDir.
export async function moveTo(fromDir, name, toDir, reason) {
  const from = path.join(fromDir, name)
  await fs.access(from) // ENOENT lebih awal kalau file sudah tidak ada
  const final = await uniqueName(toDir, name)
  const to = path.join(toDir, final)
  try {
    await fs.rename(from, to)
  } catch (err) {
    if (err.code !== 'EXDEV') throw err
    // Beda drive: salin dulu, baru hapus aslinya
    await fs.copyFile(from, to)
    await fs.unlink(from)
  }
  if (reason) {
    await fs.writeFile(path.join(toDir, `${path.basename(final, path.extname(final))}.txt`), reason)
  }
  return final
}

// File dianggap selesai ditulis kalau ukurannya sama dengan pengecekan sebelumnya.
export async function isStable(file, previousSize) {
  const { size } = await fs.stat(file)
  return { stable: previousSize !== undefined && size === previousSize, size }
}
