// Tanggal transaksi disimpan sebagai string "YYYY-MM-DD" (ISO 8601).
// Fungsi di sini hanya untuk tampilan dan isi form, bukan hitungan keuangan.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

// Date -> "2026-10-25" (pakai jam lokal, bukan UTC)
export function toISODate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// "2026-10-25" -> Date (jam 00:00 lokal)
export function parseISODate(text) {
  const [y, m, d] = text.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO() {
  return toISODate(new Date())
}

export function addDays(isoDate, days) {
  const date = parseISODate(isoDate)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

// "2026-10-25" -> "25 Okt 2026"
export function formatDate(isoDate) {
  const date = parseISODate(isoDate)
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

// "2026-10-25" -> "25 Okt"
export function formatShortDate(isoDate) {
  const date = parseISODate(isoDate)
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`
}

// Judul grup di daftar transaksi: "Hari ini", "Kemarin", atau "Jumat, 23 Okt 2026"
export function formatDateLabel(isoDate) {
  const today = todayISO()
  if (isoDate === today) return 'Hari ini'
  if (isoDate === addDays(today, -1)) return 'Kemarin'
  const date = parseISODate(isoDate)
  return `${DAYS[date.getDay()]}, ${formatDate(isoDate)}`
}

// Awal dan akhir bulan kalender, untuk pemilih periode laporan.
export function monthRange(year, monthIndex) {
  const from = toISODate(new Date(year, monthIndex, 1))
  const to = toISODate(new Date(year, monthIndex + 1, 0))
  return { from, to }
}
