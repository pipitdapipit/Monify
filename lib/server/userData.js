import 'server-only'
import { HttpError } from './errors.js'

// Dompet & kategori milik user (id + nama saja, supaya prompt AI tetap pendek).
// RLS memastikan hanya data user itu (plus kategori default) yang terbaca.
export async function loadUserLists(supabase) {
  const [wallets, categories] = await Promise.all([
    supabase.from('wallets').select('id, name'),
    supabase.from('categories').select('id, name, type'),
  ])
  if (wallets.error || categories.error) {
    throw new HttpError(502, 'Gagal mengambil data dompet / kategori.')
  }
  return { wallets: wallets.data, categories: categories.data }
}
