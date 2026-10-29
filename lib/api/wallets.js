import { USE_MOCK } from '@/lib/api/client'
import * as mock from '@/lib/api/mock/mockHandlers'
import * as db from '@/lib/api/supabaseHandlers'

// Dompet: { id, name, type: 'cash'|'bank'|'ewallet'|'other', initial_balance, balance }
// balance dihitung oleh database (view wallet_balances).

export function getWallets() {
  if (USE_MOCK) return mock.getWallets()
  return db.getWallets()
}

// data: { name, type, initial_balance }
export function createWallet(data) {
  if (USE_MOCK) return mock.createWallet(data)
  return db.createWallet(data)
}

export function updateWallet(id, data) {
  if (USE_MOCK) return mock.updateWallet(id, data)
  return db.updateWallet(id, data)
}
