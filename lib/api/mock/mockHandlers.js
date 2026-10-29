// Versi palsu dari setiap endpoint. Dipakai kalau NEXT_PUBLIC_USE_MOCK=true.
// Semua fungsi mengembalikan Promise, sama seperti fetch sungguhan.
//
// PENTING: file ini berperan sebagai "backend pura-pura". Hitungan saldo,
// safe-to-spend, dan ringkasan ada DI SINI, bukan di halaman. Saat pindah ke
// API asli, hitungan ini dikerjakan server dan halaman tidak perlu diubah.
import { ApiError, getToken } from '@/lib/api/client'
import { addDays, parseISODate, toISODate, todayISO } from '@/utils/date'
import { bills, categories, createSeedTransactions, createSeedWallets, sampleReceipt, seedSettings } from '@/lib/api/mock/mockData'

const MOCK_USER_KEY = 'monify_mock_user'
const MOCK_DB_KEY = 'monify_mock_db'
// Isi localStorage 'monify_mock_fail' = '1' untuk mencoba tampilan error.
const MOCK_FAIL_KEY = 'monify_mock_fail'

// Pura-pura menunggu jaringan, supaya state loading kelihatan.
async function delay(ms = 500) {
  await new Promise((resolve) => setTimeout(resolve, ms))
  if (localStorage.getItem(MOCK_FAIL_KEY) === '1') {
    throw new ApiError('Server sedang bermasalah (simulasi). Coba lagi nanti.', 500)
  }
}

// ---------- "Database" di localStorage ----------

function loadDb() {
  const saved = localStorage.getItem(MOCK_DB_KEY)
  if (saved) return JSON.parse(saved)
  const transactions = createSeedTransactions()
  const db = {
    wallets: createSeedWallets(transactions),
    transactions,
    settings: seedSettings,
  }
  saveDb(db)
  return db
}

function saveDb(db) {
  localStorage.setItem(MOCK_DB_KEY, JSON.stringify(db))
}

function copy(value) {
  return JSON.parse(JSON.stringify(value))
}

function validateTransaction(data) {
  if (!Number.isInteger(data.amount) || data.amount <= 0) {
    throw new ApiError('Nominal harus berupa angka bulat lebih dari 0.', 422)
  }
  if (!['income', 'expense'].includes(data.type)) throw new ApiError('Jenis transaksi tidak valid.', 422)
  if (!data.category_id) throw new ApiError('Kategori wajib diisi.', 422)
  if (!data.wallet_id) throw new ApiError('Dompet wajib diisi.', 422)
  if (!data.date) throw new ApiError('Tanggal wajib diisi.', 422)
}

// Saldo = saldo awal + pemasukan - pengeluaran (dikerjakan "server").
function walletWithBalance(wallet, transactions) {
  const balance = transactions
    .filter((t) => t.wallet_id === wallet.id)
    .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), wallet.initial_balance)
  return { ...wallet, balance }
}

// ---------- Auth ----------

export async function register({ name, email, password }) {
  await delay()
  if (!password || password.length < 6) {
    throw new ApiError('Kata sandi minimal 6 karakter.', 422)
  }
  const user = { id: 'u1', name, email }
  localStorage.setItem(MOCK_USER_KEY, JSON.stringify(user))
  return { token: 'mock-token', user }
}

export async function login({ email, password }) {
  await delay()
  // Di mode mock, email apa saja bisa masuk asal kata sandi >= 6 karakter.
  if (!password || password.length < 6) {
    throw new ApiError('Email atau kata sandi salah.', 401)
  }
  const saved = JSON.parse(localStorage.getItem(MOCK_USER_KEY) || 'null')
  const user = saved?.email === email ? saved : { id: 'u1', name: email.split('@')[0], email }
  localStorage.setItem(MOCK_USER_KEY, JSON.stringify(user))
  return { token: 'mock-token', user }
}

export async function getMe() {
  await delay(300)
  const user = JSON.parse(localStorage.getItem(MOCK_USER_KEY) || 'null')
  if (!getToken() || !user) throw new ApiError('Sesi berakhir, silakan masuk lagi.', 401)
  return user
}

// ---------- Transactions ----------

export async function getTransactions({ from, to, wallet_id, category_id, limit } = {}) {
  await delay()
  const { transactions } = loadDb()
  return transactions
    .filter((t) => !from || t.date >= from)
    .filter((t) => !to || t.date <= to)
    .filter((t) => !wallet_id || t.wallet_id === wallet_id)
    .filter((t) => !category_id || t.category_id === category_id)
    // Terbaru di atas. Untuk tanggal yang sama, yang terakhir dibuat di atas.
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id, undefined, { numeric: true }))
    .slice(0, limit || undefined)
}

export async function createTransaction(data) {
  await delay()
  validateTransaction(data)
  const db = loadDb()
  const transaction = { ...data, id: `t${Date.now()}` }
  db.transactions.push(transaction)
  saveDb(db)
  return transaction
}

export async function updateTransaction(id, data) {
  await delay()
  validateTransaction(data)
  const db = loadDb()
  const index = db.transactions.findIndex((t) => t.id === id)
  if (index === -1) throw new ApiError('Transaksi tidak ditemukan.', 404)
  db.transactions[index] = { ...data, id }
  saveDb(db)
  return db.transactions[index]
}

export async function deleteTransaction(id) {
  await delay()
  const db = loadDb()
  db.transactions = db.transactions.filter((t) => t.id !== id)
  saveDb(db)
  return null
}

// ---------- Wallets & categories ----------

export async function getWallets() {
  await delay()
  const db = loadDb()
  return db.wallets.map((w) => walletWithBalance(w, db.transactions))
}

export async function createWallet({ name, type, initial_balance }) {
  await delay()
  if (!name?.trim()) throw new ApiError('Nama dompet wajib diisi.', 422)
  if (!Number.isInteger(initial_balance) || initial_balance < 0) {
    throw new ApiError('Saldo awal harus angka bulat, minimal 0.', 422)
  }
  const db = loadDb()
  const wallet = { id: `w${Date.now()}`, name: name.trim(), type, initial_balance }
  db.wallets.push(wallet)
  saveDb(db)
  return walletWithBalance(wallet, db.transactions)
}

export async function updateWallet(id, { name, type, initial_balance }) {
  await delay()
  if (!name?.trim()) throw new ApiError('Nama dompet wajib diisi.', 422)
  if (!Number.isInteger(initial_balance) || initial_balance < 0) {
    throw new ApiError('Saldo awal harus angka bulat, minimal 0.', 422)
  }
  const db = loadDb()
  const index = db.wallets.findIndex((w) => w.id === id)
  if (index === -1) throw new ApiError('Dompet tidak ditemukan.', 404)
  db.wallets[index] = { ...db.wallets[index], name: name.trim(), type, initial_balance }
  saveDb(db)
  return walletWithBalance(db.wallets[index], db.transactions)
}

export async function getCategories() {
  await delay(300)
  return copy(categories)
}

// ---------- Summary ----------

// Tanggal gajian di bulan tertentu. Kalau payday 31 tapi bulannya cuma 30 hari,
// pakai hari terakhir bulan itu.
function paydayIn(year, monthIndex, paydayDate) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  return new Date(year, monthIndex, Math.min(paydayDate, lastDay))
}

// Siklus = dari gajian terakhir sampai sehari sebelum gajian berikutnya.
function currentCycle(paydayDate) {
  const today = parseISODate(todayISO())
  let start = paydayIn(today.getFullYear(), today.getMonth(), paydayDate)
  if (start > today) start = paydayIn(today.getFullYear(), today.getMonth() - 1, paydayDate)
  const nextPayday = paydayIn(start.getFullYear(), start.getMonth() + 1, paydayDate)
  return { cycle_start: toISODate(start), cycle_end: addDays(toISODate(nextPayday), -1) }
}

export async function getSafeToSpend() {
  await delay()
  const db = loadDb()
  const today = todayISO()
  const { cycle_start, cycle_end } = currentCycle(db.settings.payday_date)

  // Sisa hari, termasuk hari ini
  const days_left = Math.round((parseISODate(cycle_end) - parseISODate(today)) / 86400000) + 1

  // Tagihan yang jatuh tempo antara hari ini dan akhir siklus
  let upcoming_bills_total = 0
  bills.forEach((bill) => {
    let due = paydayIn(parseISODate(today).getFullYear(), parseISODate(today).getMonth(), bill.day)
    if (toISODate(due) < today) due = paydayIn(due.getFullYear(), due.getMonth() + 1, bill.day)
    if (toISODate(due) <= cycle_end) upcoming_bills_total += bill.amount
  })

  const totalBalance = db.wallets
    .map((w) => walletWithBalance(w, db.transactions))
    .reduce((sum, w) => sum + w.balance, 0)

  const amount = Math.max(0, Math.floor((totalBalance - upcoming_bills_total) / days_left))

  return { amount, days_left, upcoming_bills_total, cycle_start, cycle_end }
}

export async function getOverview({ from, to }) {
  await delay()
  const { transactions } = loadDb()
  const inRange = transactions.filter((t) => t.date >= from && t.date <= to)

  let total_income = 0
  let total_expense = 0
  const byCategory = {}
  const byDay = {}

  // Siapkan semua tanggal dalam rentang, supaya hari tanpa transaksi tetap muncul (0)
  for (let d = from; d <= to; d = addDays(d, 1)) {
    byDay[d] = { date: d, income: 0, expense: 0 }
  }

  inRange.forEach((t) => {
    if (t.type === 'income') {
      total_income += t.amount
      byDay[t.date].income += t.amount
    } else {
      total_expense += t.amount
      byDay[t.date].expense += t.amount
      byCategory[t.category_id] = (byCategory[t.category_id] || 0) + t.amount
    }
  })

  const by_category = Object.entries(byCategory)
    .map(([category_id, total]) => {
      const category = categories.find((c) => c.id === category_id)
      return { category_id, name: category?.name || 'Lainnya', color: category?.color || '#64748b', total }
    })
    .sort((a, b) => b.total - a.total)

  return { total_income, total_expense, by_category, daily: Object.values(byDay) }
}

// ---------- Settings ----------

export async function getSettings() {
  await delay(300)
  return copy(loadDb().settings)
}

export async function updateSettings(data) {
  await delay()
  const payday = Number(data.payday_date)
  if (!Number.isInteger(payday) || payday < 1 || payday > 31) {
    throw new ApiError('Tanggal gajian harus antara 1 dan 31.', 422)
  }
  const db = loadDb()
  db.settings = { ...db.settings, payday_date: payday }
  saveDb(db)
  return copy(db.settings)
}

// ---------- AI (pura-pura) ----------

// "25rb" -> 25000, "1,5jt" -> 1500000, "25.000" -> 25000, "50k" -> 50000
function findAmount(text) {
  const match = text.match(/(\d+(?:[.,]\d+)*)\s*(rb|ribu|k|jt|juta)?\b/i)
  if (!match) return 0
  const [, number, unit] = match
  const u = (unit || '').toLowerCase()
  if (u === 'jt' || u === 'juta') return Math.round(parseFloat(number.replace(',', '.')) * 1000000)
  if (u === 'rb' || u === 'ribu' || u === 'k') return Math.round(parseFloat(number.replace(',', '.')) * 1000)
  return parseInt(number.replace(/[.,]/g, ''), 10)
}

const categoryKeywords = [
  { id: 'c-gaji', words: ['gaji', 'gajian', 'salary'] },
  { id: 'c-bonus', words: ['bonus', 'thr', 'hadiah', 'angpao'] },
  { id: 'c-makan', words: ['makan', 'minum', 'kopi', 'gofood', 'grabfood', 'sarapan', 'bakso', 'nasi', 'jajan', 'shopeefood'] },
  { id: 'c-transport', words: ['bensin', 'gojek', 'goride', 'grab', 'ojek', 'krl', 'parkir', 'tol', 'transjakarta', 'mrt'] },
  { id: 'c-belanja', words: ['belanja', 'indomaret', 'alfamart', 'shopee', 'tokopedia', 'pasar', 'sabun'] },
  { id: 'c-tagihan', words: ['listrik', 'pln', 'internet', 'wifi', 'pulsa', 'kos', 'token', 'bpjs'] },
  { id: 'c-hiburan', words: ['nonton', 'bioskop', 'netflix', 'spotify', 'game', 'karaoke'] },
  { id: 'c-kesehatan', words: ['obat', 'apotek', 'dokter', 'vitamin'] },
]

const walletKeywords = [
  { id: 'w-gopay', words: ['gopay', 'gofood', 'goride', 'gojek'] },
  { id: 'w-ovo', words: ['ovo', 'grab'] },
  { id: 'w-bca', words: ['bca', 'transfer', 'debit', 'qris'] },
  { id: 'w-tunai', words: ['tunai', 'cash'] },
]

function findByKeywords(text, list) {
  const words = text.toLowerCase()
  return list.find((item) => item.words.some((w) => words.includes(w)))?.id || null
}

export async function parseTransaction(text) {
  await delay(900)
  const amount = findAmount(text)
  const category_id = findByKeywords(text, categoryKeywords)
  const category = categories.find((c) => c.id === category_id)
  const type = category?.type || 'expense'
  // Pemasukan biasanya masuk rekening, pengeluaran biasanya tunai
  const wallet_id = findByKeywords(text, walletKeywords) || (type === 'income' ? 'w-bca' : 'w-tunai')
  const lower = text.toLowerCase()
  const date = lower.includes('kemarin') ? addDays(todayISO(), -1) : todayISO()

  // Makin banyak yang berhasil dikenali, makin yakin.
  let confidence = 0.3
  if (amount) confidence += 0.35
  if (category_id) confidence += 0.3

  return {
    amount,
    type,
    category_id: category_id || (type === 'income' ? 'c-pemasukan-lain' : 'c-lainnya'),
    wallet_id,
    date,
    note: text.trim(),
    confidence: Math.round(confidence * 100) / 100,
  }
}

export async function parseReceipt(file) {
  await delay(1800)
  if (!file?.type?.startsWith('image/')) {
    throw new ApiError('File harus berupa gambar.', 422)
  }
  return { ...copy(sampleReceipt), date: todayISO() }
}
