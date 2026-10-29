import Link from 'next/link'
import { formatRupiah } from '@/utils/formatRupiah'
import { walletTypeIcon, walletTypeLabel } from '@/utils/labels'
import Skeleton from '@/components/ui/Skeleton'
import ErrorState from '@/components/ui/ErrorState'
import EmptyState from '@/components/ui/EmptyState'

// Saldo per dompet, bisa digeser ke samping di mobile.
export default function WalletBalances({ wallets, loading, error, onRetry }) {
  if (error) return <ErrorState message={error.message} onRetry={onRetry} />

  if (loading) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-40 shrink-0 rounded-2xl" />
        ))}
      </div>
    )
  }

  if (wallets.length === 0) {
    return (
      <EmptyState
        title="Belum ada dompet"
        action={
          <Link href="/wallets" className="text-sm font-semibold text-teal-700">
            Tambah dompet
          </Link>
        }
      />
    )
  }

  return (
    // -mx-4 px-4: biar bisa digeser sampai tepi layar di mobile
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-2 md:px-0">
      {wallets.map((wallet) => (
        <div key={wallet.id} className="w-40 shrink-0 snap-start rounded-2xl bg-white p-4 shadow-sm md:w-auto">
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>{walletTypeIcon(wallet.type)}</span>
            {walletTypeLabel(wallet.type)}
          </p>
          <p className="mt-1 truncate text-sm font-medium">{wallet.name}</p>
          <p className="truncate font-bold">{formatRupiah(wallet.balance)}</p>
        </div>
      ))}
    </div>
  )
}
