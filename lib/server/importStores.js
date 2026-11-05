import 'server-only'
import { HttpError } from './errors.js'

// Tempat importScreenshot membaca & menyimpan transaksi. Dua sumber login, satu alur:
//   store.findExisting({ walletId, from, to }) -> [{ date, type, amount }]
//   store.insert({ walletId, rows })           -> rows: [{ date, type, amount, note, category_id }]
// Semua baris dalam satu insert: tersimpan semua, atau tidak sama sekali.

const readFailed = () => new HttpError(502, 'Gagal mengambil transaksi yang sudah ada.')
const saveFailed = () => new HttpError(502, 'Gagal menyimpan transaksi.')

// Client yang sudah login sebagai user (watcher di laptop): RLS menjaga kepemilikan.
export function supabaseStore(supabase) {
  return {
    async findExisting({ walletId, from, to }) {
      const { data, error } = await supabase
        .from('transactions')
        .select('date, type, amount')
        .eq('wallet_id', walletId)
        .gte('date', from)
        .lte('date', to)
      if (error) throw readFailed()
      return data
    },
    async insert({ walletId, rows }) {
      const withWallet = rows.map((r) => ({ ...r, wallet_id: walletId, source: 'ai_receipt' }))
      const { error } = await supabase.from('transactions').insert(withWallet)
      if (error) throw saveFailed()
    },
  }
}

// Client tanpa login + personal API key (iPhone Shortcut): fungsi SQL api_key_* yang
// meng-hash key, mencari pemiliknya, dan hanya menyentuh data user itu.
export function apiKeyStore(supabase, key) {
  return {
    async findExisting({ walletId, from, to }) {
      const { data, error } = await supabase.rpc('api_key_existing', {
        p_key: key,
        p_wallet_id: walletId,
        p_from: from,
        p_to: to,
      })
      // Fungsi SQL membatasi rentang tanggal (key yang bocor tidak bisa menyedot riwayat)
      if (error?.code === '22023') {
        throw new HttpError(422, 'Tanggal di screenshot terlalu berjauhan (maksimal 62 hari, dalam 400 hari terakhir).')
      }
      if (error) throw readFailed()
      return data
    },
    async insert({ walletId, rows }) {
      const { error } = await supabase.rpc('api_key_insert_transactions', {
        p_key: key,
        p_wallet_id: walletId,
        p_rows: rows,
      })
      if (error) throw saveFailed()
    },
  }
}
