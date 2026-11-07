import { formatRupiah } from '../../utils/formatRupiah.js'

// Satu kalimat hasil import screenshot, untuk notifikasi iPhone Shortcut.
// result = hasil importScreenshot (status 'saved' atau 'review').
export function importMessage(result) {
  if (result.status === 'review') return `Perlu dicek: ${result.reason}`

  const notes = []
  if (result.skipped > 0) notes.push(`${result.skipped} duplikat dilewati`)
  if (result.dropped > 0) notes.push(`${result.dropped} baris dilewati karena tidak jelas`)
  const suffix = notes.length > 0 ? ` (${notes.join(', ')})` : ''

  if (result.inserted === 0) return `Tidak ada transaksi baru di ${result.wallet}${suffix}`
  const amounts = []
  if (result.expense > 0) amounts.push(`keluar ${formatRupiah(result.expense)}`)
  if (result.income > 0) amounts.push(`masuk ${formatRupiah(result.income)}`)
  return `${result.inserted} transaksi tersimpan ke ${result.wallet}: ${amounts.join(', ')}${suffix}`
}
