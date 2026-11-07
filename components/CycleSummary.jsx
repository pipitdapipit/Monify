import { formatRupiah } from '@/utils/formatRupiah'
import Skeleton from '@/components/ui/Skeleton'
import ErrorState from '@/components/ui/ErrorState'

// Total pemasukan & pengeluaran siklus ini (dari /summary/overview).
export default function CycleSummary({ data, loading, error, onRetry }) {
  if (error) return <ErrorState message={error.message} onRetry={onRetry} />

  const items = [
    { label: 'Masuk', value: data?.total_income },
    { label: 'Keluar', value: data?.total_expense },
  ]
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <div key={item.label}>
          <p className="text-xs text-mute">{item.label}</p>
          {loading || !data ? (
            <Skeleton className="mt-1 h-5 w-24" />
          ) : (
            <p className="font-semibold">{formatRupiah(item.value)}</p>
          )}
        </div>
      ))}
    </div>
  )
}
