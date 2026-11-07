import Link from 'next/link'
import { formatRupiah } from '@/utils/formatRupiah'
import Skeleton from '@/components/ui/Skeleton'
import ErrorState from '@/components/ui/ErrorState'
import EmptyState from '@/components/ui/EmptyState'

// Saldo per dompet, satu baris per dompet.
export default function WalletBalances({ wallets, loading, error, onRetry }) {
  if (error) return <ErrorState message={error.message} onRetry={onRetry} />

  if (loading) {
    return (
      <div className="flex flex-col gap-3 py-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-5" />
        ))}
      </div>
    )
  }

  if (wallets.length === 0) {
    return (
      <EmptyState
        title="Belum ada dompet"
        action={
          <Link href="/wallets" className="text-sm font-semibold text-acc">
            Tambah dompet
          </Link>
        }
      />
    )
  }

  return (
    <ul className="divide-y divide-line">
      {wallets.map((wallet) => (
        <li key={wallet.id} className="flex justify-between gap-3 py-2.5 text-sm font-medium">
          <span className="truncate">{wallet.name}</span>
          <span className={`shrink-0 ${wallet.balance < 0 ? 'text-red-600' : ''}`}>{formatRupiah(wallet.balance)}</span>
        </li>
      ))}
    </ul>
  )
}
