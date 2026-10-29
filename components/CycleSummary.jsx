import { formatRupiah } from '@/utils/formatRupiah'
import Skeleton from '@/components/ui/Skeleton'
import ErrorState from '@/components/ui/ErrorState'

// Total pemasukan & pengeluaran siklus ini (dari /summary/overview).
export default function CycleSummary({ data, loading, error, onRetry }) {
  if (error) return <ErrorState message={error.message} onRetry={onRetry} />

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-xs text-slate-500">Pemasukan siklus ini</p>
        {loading || !data ? (
          <Skeleton className="mt-2 h-6 w-28" />
        ) : (
          <p className="mt-1 text-lg font-bold text-green-600">{formatRupiah(data.total_income)}</p>
        )}
      </div>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-xs text-slate-500">Pengeluaran siklus ini</p>
        {loading || !data ? (
          <Skeleton className="mt-2 h-6 w-28" />
        ) : (
          <p className="mt-1 text-lg font-bold text-red-600">{formatRupiah(data.total_expense)}</p>
        )}
      </div>
    </div>
  )
}
