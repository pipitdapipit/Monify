'use client'

import { getWallets } from '@/lib/api/wallets'
import { useApi } from '@/hooks/useApi'

// Daftar dompet (dengan saldo dari API) + fungsi bantu cari berdasarkan id.
export function useWallets() {
  const { data, loading, error, refetch } = useApi(() => getWallets(), [])
  const wallets = data || []

  function findWallet(id) {
    return wallets.find((w) => w.id === id)
  }

  return { wallets, findWallet, loading, error, refetch }
}
