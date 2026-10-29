'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSafeToSpend, getOverview } from '@/lib/api/summary'
import { getTransactions } from '@/lib/api/transactions'
import { useAuth } from '@/context/AuthContext'
import { useApi } from '@/hooks/useApi'
import { useCategories } from '@/hooks/useCategories'
import { useWallets } from '@/hooks/useWallets'
import SafeToSpendCard from '@/components/SafeToSpendCard'
import CycleSummary from '@/components/CycleSummary'
import WalletBalances from '@/components/WalletBalances'
import QuickAddInput from '@/components/QuickAddInput'
import TransactionItem from '@/components/TransactionItem'
import Skeleton from '@/components/ui/Skeleton'
import ErrorState from '@/components/ui/ErrorState'
import EmptyState from '@/components/ui/EmptyState'

function SectionTitle({ title, linkTo, linkText }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="font-semibold text-slate-700">{title}</h2>
      {linkTo && (
        <Link href={linkTo} className="text-sm font-medium text-teal-700">
          {linkText}
        </Link>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const router = useRouter()

  const safe = useApi(() => getSafeToSpend(), [])
  // Ringkasan siklus butuh tanggal siklus dari safe-to-spend, jadi tunggu itu dulu.
  const cycleStart = safe.data?.cycle_start
  const cycleEnd = safe.data?.cycle_end
  const overview = useApi(
    () => (cycleStart ? getOverview({ from: cycleStart, to: cycleEnd }) : Promise.resolve(null)),
    [cycleStart, cycleEnd],
  )
  const recent = useApi(() => getTransactions({ limit: 5 }), [])
  const { wallets, findWallet, loading: walletsLoading, error: walletsError, refetch: refetchWallets } = useWallets()
  const { findCategory } = useCategories()

  // API sudah mengurutkan terbaru di atas; ambil 5 pertama untuk ditampilkan.
  const lastFive = (recent.data || []).slice(0, 5)

  // Teks dikirim ke halaman Tambah, yang memanggil AI lalu membuka modal konfirmasi.
  function handleQuickAdd(text) {
    router.push('/add?text=' + encodeURIComponent(text))
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-slate-500">Halo,</p>
        <h1 className="text-xl font-bold">{user?.name} 👋</h1>
      </div>

      <SafeToSpendCard data={safe.data} loading={safe.loading} error={safe.error} onRetry={safe.refetch} />

      <QuickAddInput onSubmit={handleQuickAdd} />

      <section>
        <SectionTitle title="Siklus ini" linkTo="/reports" linkText="Laporan" />
        <CycleSummary
          data={overview.data}
          loading={safe.loading || overview.loading}
          error={overview.error}
          onRetry={overview.refetch}
        />
      </section>

      <section>
        <SectionTitle title="Dompet" linkTo="/wallets" linkText="Kelola" />
        <WalletBalances wallets={wallets} loading={walletsLoading} error={walletsError} onRetry={refetchWallets} />
      </section>

      <section>
        <SectionTitle title="Transaksi terakhir" linkTo="/transactions" linkText="Lihat semua" />
        {recent.error ? (
          <ErrorState message={recent.error.message} onRetry={recent.refetch} />
        ) : recent.loading ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : lastFive.length === 0 ? (
          <EmptyState title="Belum ada transaksi" description="Ketik transaksi pertamamu di kotak di atas." />
        ) : (
          <div className="divide-y divide-slate-100 rounded-2xl bg-white px-4 shadow-sm">
            {lastFive.map((t) => (
              <TransactionItem
                key={t.id}
                transaction={t}
                category={findCategory(t.category_id)}
                wallet={findWallet(t.wallet_id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
