// Versi Supabase dari setiap endpoint (dipakai kalau NEXT_PUBLIC_USE_MOCK bukan 'true').
// Bentuk data yang dikembalikan sama persis dengan mock/mockHandlers.js,
// jadi halaman tidak perlu tahu data berasal dari mana.
//
// Keamanan: semua query memakai login user, dan RLS di database yang memastikan
// user hanya bisa membaca / mengubah datanya sendiri. Hitungan saldo, safe-to-spend
// dan ringkasan dikerjakan database (view & fungsi SQL), bukan di sini.
import { ApiError } from '@/lib/api/client'
import { supabase } from '@/lib/api/supabase'

function db() {
  if (!supabase) {
    throw new ApiError(
      'Supabase belum dikonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY di .env.local, lalu restart npm run dev.',
      0,
    )
  }
  return supabase
}

// Ubah error Supabase jadi ApiError berbahasa Indonesia.
function check(error) {
  if (!error) return
  const byCode = {
    '42501': 'Tidak diizinkan. Pastikan kamu sudah masuk dan dompet/kategori yang dipilih valid.',
    '23514': 'Data tidak valid. Periksa nominal dan isian lainnya.',
    '23503': 'Data ini masih dipakai oleh data lain.',
    PGRST205: 'Tabel belum ada di database. Jalankan migration dulu.',
  }
  if (error.message === 'Failed to fetch') {
    throw new ApiError('Tidak bisa terhubung ke server. Cek koneksi internet kamu.', 0)
  }
  const status = error.code === 'PGRST301' ? 401 : 400
  throw new ApiError(byCode[error.code] || error.message, status)
}

// Pesan untuk error login / register.
function authError(error) {
  const byCode = {
    invalid_credentials: 'Email atau kata sandi salah.',
    email_not_confirmed: 'Email belum dikonfirmasi. Cek kotak masuk kamu.',
    user_already_exists: 'Email ini sudah terdaftar. Silakan masuk.',
    email_exists: 'Email ini sudah terdaftar. Silakan masuk.',
    weak_password: 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.',
    over_request_rate_limit: 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.',
    over_email_send_rate_limit: 'Terlalu banyak email terkirim. Coba lagi nanti.',
  }
  if (error.message === 'Failed to fetch' || error.status === 0) {
    return new ApiError('Tidak bisa terhubung ke server. Cek koneksi internet kamu.', 0)
  }
  return new ApiError(byCode[error.code] || error.message, error.status || 400)
}

function toUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name || user.email.split('@')[0],
  }
}

// ---------- Auth ----------

export async function register({ name, email, password }) {
  const { data, error } = await db().auth.signUp({ email, password, options: { data: { name } } })
  if (error) throw authError(error)
  // Kalau konfirmasi email aktif di Supabase, belum ada sesi sampai email dikonfirmasi.
  if (!data.session) return { needsConfirmation: true }
  return { token: data.session.access_token, user: toUser(data.user) }
}

export async function login({ email, password }) {
  const { data, error } = await db().auth.signInWithPassword({ email, password })
  if (error) throw authError(error)
  return { token: data.session.access_token, user: toUser(data.user) }
}

export async function getMe() {
  const { data, error } = await db().auth.getUser()
  if (error || !data.user) throw new ApiError('Sesi berakhir, silakan masuk lagi.', 401)
  return toUser(data.user)
}

export async function logout() {
  await db().auth.signOut()
}

// ---------- Transactions ----------

const TX_COLUMNS = 'id, type, amount, category_id, wallet_id, date, note, source'

export async function getTransactions({ from, to, wallet_id, category_id, limit } = {}) {
  let query = db()
    .from('transactions')
    .select(TX_COLUMNS)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)
  if (wallet_id) query = query.eq('wallet_id', wallet_id)
  if (category_id) query = query.eq('category_id', category_id)
  if (limit) query = query.limit(limit)

  const { data, error } = await query
  check(error)
  return data
}

// Hanya kolom yang boleh diisi user. user_id diisi database (auth.uid()).
function transactionFields(data) {
  return {
    wallet_id: data.wallet_id,
    category_id: data.category_id,
    type: data.type,
    amount: data.amount,
    date: data.date,
    note: data.note || null,
  }
}

export async function createTransaction(data) {
  if (!Number.isInteger(data.amount) || data.amount <= 0) {
    throw new ApiError('Nominal harus berupa angka bulat lebih dari 0.', 422)
  }
  const row = { ...transactionFields(data), source: data.source || 'manual' }
  const { data: saved, error } = await db().from('transactions').insert(row).select(TX_COLUMNS).single()
  check(error)
  return saved
}

export async function updateTransaction(id, data) {
  if (!Number.isInteger(data.amount) || data.amount <= 0) {
    throw new ApiError('Nominal harus berupa angka bulat lebih dari 0.', 422)
  }
  const { data: saved, error } = await db()
    .from('transactions')
    .update(transactionFields(data))
    .eq('id', id)
    .select(TX_COLUMNS)
    .single()
  check(error)
  return saved
}

export async function deleteTransaction(id) {
  const { error } = await db().from('transactions').delete().eq('id', id)
  check(error)
  return null
}

// ---------- Wallets & categories ----------

const WALLET_COLUMNS = 'id, name, type, initial_balance, include_in_budget'

// Saldo (balance) dihitung oleh view wallet_balances di database.
export async function getWallets() {
  const [wallets, balances] = await Promise.all([
    db().from('wallets').select(WALLET_COLUMNS).order('created_at'),
    db().from('wallet_balances').select('wallet_id, balance'),
  ])
  check(wallets.error)
  check(balances.error)

  const balanceById = new Map(balances.data.map((b) => [b.wallet_id, Number(b.balance)]))
  return wallets.data.map((w) => ({ ...w, balance: balanceById.get(w.id) ?? w.initial_balance }))
}

function validateWallet({ name, initial_balance }) {
  if (!name?.trim()) throw new ApiError('Nama dompet wajib diisi.', 422)
  if (!Number.isInteger(initial_balance) || initial_balance < 0) {
    throw new ApiError('Saldo awal harus angka bulat, minimal 0.', 422)
  }
}

export async function createWallet({ name, type, initial_balance }) {
  validateWallet({ name, initial_balance })
  const { data, error } = await db()
    .from('wallets')
    .insert({ name: name.trim(), type, initial_balance })
    .select(WALLET_COLUMNS)
    .single()
  check(error)
  return { ...data, balance: data.initial_balance }
}

export async function updateWallet(id, { name, type, initial_balance }) {
  validateWallet({ name, initial_balance })
  const { data, error } = await db()
    .from('wallets')
    .update({ name: name.trim(), type, initial_balance })
    .eq('id', id)
    .select(WALLET_COLUMNS)
    .single()
  check(error)

  const balance = await db().from('wallet_balances').select('balance').eq('wallet_id', id).single()
  check(balance.error)
  return { ...data, balance: Number(balance.data.balance) }
}

export async function getCategories() {
  const { data, error } = await db().from('categories').select('id, name, type, icon, color')
  check(error)
  // Pengeluaran dulu, lalu pemasukan; "Lainnya" selalu di akhir tiap jenis.
  const rank = (c) => (c.type === 'expense' ? 0 : 1)
  return data.sort(
    (a, b) =>
      rank(a) - rank(b) || (a.name === 'Lainnya') - (b.name === 'Lainnya') || a.name.localeCompare(b.name, 'id'),
  )
}

// ---------- Summary (dihitung oleh fungsi SQL) ----------

export async function getSafeToSpend() {
  const { data, error } = await db().rpc('safe_to_spend')
  check(error)
  return data
}

export async function getOverview({ from, to }) {
  const { data, error } = await db().rpc('overview', { p_from: from, p_to: to })
  check(error)
  return data
}

// ---------- Settings ----------

export async function getSettings() {
  const { data, error } = await db().from('settings').select('payday_date').maybeSingle()
  check(error)
  // User baru belum punya baris pengaturan: pakai tanggal 25 (sama dengan default database)
  return data || { payday_date: 25 }
}

export async function updateSettings(data) {
  const payday = Number(data.payday_date)
  if (!Number.isInteger(payday) || payday < 1 || payday > 31) {
    throw new ApiError('Tanggal gajian harus antara 1 dan 31.', 422)
  }
  const session = await db().auth.getSession()
  const userId = session.data.session?.user.id
  if (!userId) throw new ApiError('Sesi berakhir, silakan masuk lagi.', 401)

  const { data: saved, error } = await db()
    .from('settings')
    .upsert({ user_id: userId, payday_date: payday })
    .select('payday_date')
    .single()
  check(error)
  return saved
}
