// Data awal untuk mode mock. Transaksi dibuat relatif terhadap hari ini,
// jadi demo selalu terlihat "baru".
import { addDays, todayISO } from '@/utils/date'

export const categories = [
  { id: 'c-makan', name: 'Makan & Minum', type: 'expense', icon: '🍜', color: '#eb6834' },
  { id: 'c-transport', name: 'Transportasi', type: 'expense', icon: '🛵', color: '#2a78d6' },
  { id: 'c-belanja', name: 'Belanja', type: 'expense', icon: '🛒', color: '#1baf7a' },
  { id: 'c-tagihan', name: 'Tagihan', type: 'expense', icon: '🧾', color: '#eda100' },
  { id: 'c-hiburan', name: 'Hiburan', type: 'expense', icon: '🎬', color: '#e87ba4' },
  { id: 'c-kesehatan', name: 'Kesehatan', type: 'expense', icon: '💊', color: '#008300' },
  { id: 'c-lainnya', name: 'Lainnya', type: 'expense', icon: '📦', color: '#6250d6' },
  { id: 'c-gaji', name: 'Gaji', type: 'income', icon: '💼', color: '#16a34a' },
  { id: 'c-bonus', name: 'Bonus & Hadiah', type: 'income', icon: '🎁', color: '#22c55e' },
  { id: 'c-pemasukan-lain', name: 'Pemasukan Lain', type: 'income', icon: '💰', color: '#84cc16' },
]

// target_balance = saldo yang diinginkan hari ini. initial_balance dihitung
// di createSeedWallets() supaya saldo akhir selalu masuk akal.
const walletTemplates = [
  { id: 'w-tunai', name: 'Tunai', type: 'cash', target_balance: 185000 },
  { id: 'w-bca', name: 'BCA', type: 'bank', target_balance: 9850000 },
  { id: 'w-gopay', name: 'GoPay', type: 'ewallet', target_balance: 92500 },
  { id: 'w-ovo', name: 'OVO', type: 'ewallet', target_balance: 41000 },
]

// initial_balance = saldo target dikurangi total transaksi contoh di dompet itu.
export function createSeedWallets(transactions) {
  return walletTemplates.map(({ target_balance, ...wallet }) => {
    const net = transactions
      .filter((t) => t.wallet_id === wallet.id)
      .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0)
    return { ...wallet, initial_balance: target_balance - net }
  })
}

// Tagihan rutin tiap bulan (tanggal jatuh tempo), dipakai untuk safe-to-spend.
export const bills = [
  { name: 'Kos', amount: 1500000, day: 1 },
  { name: 'Listrik PLN', amount: 350000, day: 5 },
  { name: 'Internet', amount: 330000, day: 10 },
  { name: 'Spotify', amount: 54990, day: 15 },
]

export const seedSettings = { payday_date: 25 }

// Angka acak yang selalu sama setiap kali (seeded), supaya demo konsisten.
function createRandom(seed) {
  return function random() {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

const expenseTemplates = [
  { category_id: 'c-makan', notes: ['Makan siang', 'Kopi susu gula aren', 'Nasi padang', 'GoFood ayam geprek', 'Bakso'], min: 15000, max: 55000, wallets: ['w-tunai', 'w-gopay', 'w-ovo'] },
  { category_id: 'c-makan', notes: ['Sarapan bubur', 'Gorengan', 'Es teh'], min: 5000, max: 20000, wallets: ['w-tunai'] },
  { category_id: 'c-transport', notes: ['GoRide ke kantor', 'Bensin motor', 'KRL', 'Grab pulang'], min: 5000, max: 45000, wallets: ['w-gopay', 'w-tunai', 'w-ovo'] },
  { category_id: 'c-belanja', notes: ['Indomaret', 'Alfamart', 'Shopee kebutuhan rumah', 'Sayur di pasar'], min: 25000, max: 220000, wallets: ['w-bca', 'w-tunai', 'w-gopay'] },
  { category_id: 'c-hiburan', notes: ['Nonton bioskop', 'Top up game', 'Karaoke'], min: 40000, max: 150000, wallets: ['w-bca', 'w-ovo'] },
  { category_id: 'c-kesehatan', notes: ['Apotek', 'Vitamin'], min: 20000, max: 90000, wallets: ['w-tunai', 'w-bca'] },
]

// Buat transaksi untuk `days` hari terakhir.
export function createSeedTransactions(days = 45) {
  const random = createRandom(42)
  const pick = (list) => list[Math.floor(random() * list.length)]
  // Bulatkan ke 500 terdekat supaya terlihat seperti harga sungguhan
  const amountBetween = (min, max) => Math.round((min + random() * (max - min)) / 500) * 500

  const today = todayISO()
  const transactions = []
  let counter = 1

  for (let i = days; i >= 0; i--) {
    const date = addDays(today, -i)
    const dayOfMonth = Number(date.slice(8, 10))

    if (dayOfMonth === seedSettings.payday_date) {
      transactions.push({ id: `t${counter++}`, type: 'income', amount: 7500000, category_id: 'c-gaji', wallet_id: 'w-bca', date, note: 'Gaji bulanan' })
    }

    bills.forEach((bill) => {
      if (bill.day === dayOfMonth) {
        transactions.push({ id: `t${counter++}`, type: 'expense', amount: bill.amount, category_id: 'c-tagihan', wallet_id: 'w-bca', date, note: bill.name })
      }
    })

    // 1-2 pengeluaran harian
    const count = random() < 0.4 ? 2 : 1
    for (let j = 0; j < count; j++) {
      const t = pick(expenseTemplates)
      transactions.push({ id: `t${counter++}`, type: 'expense', amount: amountBetween(t.min, t.max), category_id: t.category_id, wallet_id: pick(t.wallets), date, note: pick(t.notes) })
    }

    if (i === 12) {
      transactions.push({ id: `t${counter++}`, type: 'income', amount: 350000, category_id: 'c-pemasukan-lain', wallet_id: 'w-gopay', date, note: 'Jual barang bekas' })
    }
  }

  return transactions
}

// Contoh hasil scan struk.
export const sampleReceipt = {
  merchant: 'Indomaret Kemang Raya',
  total: 87500,
  items: [
    { name: 'Indomie Goreng x5', price: 17500 },
    { name: 'Susu UHT 1L', price: 21900 },
    { name: 'Roti Tawar', price: 16500 },
    { name: 'Sabun Cuci Piring', price: 14600 },
    { name: 'Air Mineral 1,5L x2', price: 17000 },
  ],
  suggested_category_id: 'c-belanja',
}
