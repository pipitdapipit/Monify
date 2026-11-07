'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSafeToSpend, getOverview } from '@/lib/api/summary'
import { getTransactions } from '@/lib/api/transactions'
import { useApi } from '@/hooks/useApi'
import { useCategories } from '@/hooks/useCategories'
import { useWallets } from '@/hooks/useWallets'
import { formatShortDate } from '@/utils/date'
import { formatRupiah } from '@/utils/formatRupiah'
import { buildProfile } from '@/utils/profile'
import CycleSummary from '@/components/CycleSummary'
import ElevationProfile from '@/components/ElevationProfile'
import QuickAddInput from '@/components/QuickAddInput'
import TransactionItem from '@/components/TransactionItem'
import WalletBalances from '@/components/WalletBalances'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import Skeleton from '@/components/ui/Skeleton'

function SectionTitle({ title, right, linkTo }) {
  return (
    <div className="mb-1 flex items-center justify-between font-mono text-[10.5px] tracking-widest text-mute uppercase">
      <h2>{title}</h2>
      {linkTo ? <Link href={linkTo}>{right}</Link> : <span>{right}</span>}
    </div>
  )
}

export default function Dashboard() {
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
  const profile = buildProfile(safe.data, overview.data?.daily)
  const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0)

  // Teks dikirim ke halaman Tambah, yang memanggil AI lalu membuka modal konfirmasi.
  function handleQuickAdd(text) {
    router.push('/add?text=' + encodeURIComponent(text))
  }

  return (
    <div className="grid gap-x-12 gap-y-6 md:grid-cols-[1.25fr_1fr]">
      <div className="flex flex-col gap-6">
        <section>
          <p className="font-mono text-[10.5px] tracking-widest text-mute uppercase">Aman dipakai hari ini</p>
          {safe.error ? (
            <ErrorState message={safe.error.message} onRetry={safe.refetch} />
          ) : safe.loading || !safe.data ? (
            <>
              <Skeleton className="mt-2 h-11 w-56" />
              <Skeleton className="mt-3 h-4 w-44" />
            </>
          ) : (
            <>
              <p className="mt-1 text-[clamp(2.5rem,12vw,3.75rem)] leading-none font-bold tracking-tighter">
                {formatRupiah(safe.data.amount)}
              </p>
              <p className="mt-2 text-sm text-mute">
                {safe.data.days_left} hari lagi · tagihan {formatRupiah(safe.data.upcoming_bills_total)}
              </p>
            </>
          )}
          {!safe.error && <ElevationProfile profile={profile} />}
        </section>

        <QuickAddInput onSubmit={handleQuickAdd} />

        <section>
          <SectionTitle
            title="Siklus ini"
            right={cycleStart ? `${formatShortDate(cycleStart)} – ${formatShortDate(cycleEnd)}` : ''}
          />
          <CycleSummary
            data={overview.data}
            loading={safe.loading || overview.loading}
            error={overview.error}
            onRetry={overview.refetch}
          />
        </section>
      </div>

      <div className="flex flex-col gap-6">
        <section>
          <SectionTitle title="Terakhir" right="Lihat semua" linkTo="/transactions" />
          {recent.error ? (
            <ErrorState message={recent.error.message} onRetry={recent.refetch} />
          ) : recent.loading ? (
            <div className="flex flex-col gap-3 py-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : lastFive.length === 0 ? (
            <EmptyState title="Belum ada transaksi" description="Ketik transaksi pertamamu di kotak di sebelah." />
          ) : (
            <div className="divide-y divide-line">
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

        <section>
          <SectionTitle title="Dompet" right={formatRupiah(totalBalance)} linkTo="/wallets" />
          <WalletBalances wallets={wallets} loading={walletsLoading} error={walletsError} onRetry={refetchWallets} />
        </section>
      </div>
    </div>
  )
}
