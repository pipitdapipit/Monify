import { formatRupiah } from '@/utils/formatRupiah'
import { formatShortDate } from '@/utils/date'
import Skeleton from '@/components/ui/Skeleton'
import ErrorState from '@/components/ui/ErrorState'

// Kartu besar "Aman dipakai hari ini". Semua angka langsung dari API.
export default function SafeToSpendCard({ data, loading, error, onRetry }) {
  if (error) return <ErrorState message={error.message} onRetry={onRetry} />

  if (loading || !data) {
    return (
      <div className="rounded-3xl bg-teal-600 p-5">
        <Skeleton className="h-4 w-36 bg-teal-500" />
        <Skeleton className="mt-3 h-10 w-52 bg-teal-500" />
        <Skeleton className="mt-4 h-4 w-44 bg-teal-500" />
      </div>
    )
  }

  return (
    <div className="rounded-3xl bg-gradient-to-br from-teal-600 to-emerald-600 p-5 text-white shadow-lg shadow-teal-600/20">
      <p className="text-sm text-teal-50">Aman dipakai hari ini</p>
      <p className="mt-1 text-4xl font-bold tracking-tight">{formatRupiah(data.amount)}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/20 pt-3 text-sm">
        <div>
          <p className="text-teal-100">Sisa hari</p>
          <p className="font-semibold">{data.days_left} hari lagi</p>
        </div>
        <div>
          <p className="text-teal-100">Tagihan mendatang</p>
          <p className="font-semibold">{formatRupiah(data.upcoming_bills_total)}</p>
        </div>
      </div>

      <p className="mt-3 text-xs text-teal-100">
        Siklus gajian: {formatShortDate(data.cycle_start)} – {formatShortDate(data.cycle_end)}
      </p>
    </div>
  )
}
