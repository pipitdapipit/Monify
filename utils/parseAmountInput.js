// Ubah teks dari input nominal jadi bilangan bulat rupiah.
// "25.000" -> 25000, "Rp 1.500.000" -> 1500000, "" -> 0
// Semua karakter selain angka dibuang, jadi tidak akan pernah ada desimal.
export function parseAmountInput(text) {
  const digits = String(text).replace(/\D/g, '')
  return digits ? parseInt(digits, 10) : 0
}
