// Uang selalu disimpan sebagai bilangan bulat rupiah (tanpa desimal).
// formatRupiah(25000)  -> "Rp 25.000"
// formatRupiah(-15000) -> "-Rp 15.000"
const numberFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

export function formatRupiah(n) {
  const value = Math.round(Number(n) || 0)
  const sign = value < 0 ? '-' : ''
  return `${sign}Rp ${numberFormat.format(Math.abs(value))}`
}

// Versi singkat untuk sumbu grafik: 25000 -> "25rb", 1500000 -> "1,5jt"
export function formatCompactRupiah(n) {
  const value = Math.round(Number(n) || 0)
  const short = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 })
  if (Math.abs(value) >= 1000000) return `${short.format(value / 1000000)}jt`
  if (Math.abs(value) >= 1000) return `${short.format(value / 1000)}rb`
  return String(value)
}

// Hanya angka, tanpa "Rp": 25000 -> "25.000". Dipakai di input nominal.
export function formatThousands(n) {
  return numberFormat.format(Math.round(Number(n) || 0))
}
