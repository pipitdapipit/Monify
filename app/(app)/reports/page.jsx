'use client'

import { useState } from 'react'
import { getOverview, getSafeToSpend } from '@/lib/api/summary'
import { useApi } from '@/hooks/useApi'
import { formatDate, monthRange, todayISO } from '@/utils/date'
import { formatRupiah } from '@/utils/formatRupiah'
import CategoryDonut from '@/components/CategoryDonut'
import DailyExpenseChart from '@/components/DailyExpenseChart'
import Skeleton from '@/components/ui/Skeleton'
import ErrorState from '@/components/ui/ErrorState'
import EmptyState from '@/components/ui/EmptyState'
import { fieldClass } from '@/components/ui/Field'

const periods = [
  { value: 'cycle', label: 'Siklus gajian' },
  { value: 'this_month', label: 'Bulan ini' },
  { value: 'last_month', label: 'Bulan lalu' },
  { value: 'custom', label: 'Pilih tanggal' },
]

export default function Reports() {
  const [period, setPeriod] = useState('this_month')
  const [custom, setCustom] = useState(() => {
    const now = new Date()
    return monthRange(now.getFullYear(), now.getMonth())
  })

  // Tanggal siklus gajian diambil dari API (bukan dihitung di sini).
  const cycle = useApi(() => getSafeToSpend(), [])

  // Tentukan rentang tanggal sesuai pilihan periode
  const now = new Date()
  let range
  if (period === 'this_month') range = monthRange(now.getFullYear(), now.getMonth())
  else if (period === 'last_month') range = monthRange(now.getFullYear(), now.getMonth() - 1)
  else if (period === 'custom') range = custom
  else range = cycle.data ? { from: cycle.data.cycle_start, to: cycle.data.cycle_end } : { from: '', to: '' }

  const overview = useApi(
    () => (range.from && range.to ? getOverview(range) : Promise.resolve(null)),
    [range.from, range.to],
  )

  const waitingForCycle = period === 'cycle' && cycle.loading
  const loading = waitingForCycle || overview.loading
  const error = (period === 'cycle' && cycle.error) || overview.error
  const data = overview.data
  const isEmpty = data && data.total_income === 0 && data.total_expense === 0

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Laporan</h1>

      {/* Pemilih periode */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${
              period === p.value ? 'bg-teal-600 text-white' : 'bg-white text-slate-600 shadow-sm'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-500">
            Dari
            <input
              type="date"
              value={custom.from}
              max={custom.to || todayISO()}
              onChange={(e) => setCustom({ ...custom, from: e.target.value })}
              className={`${fieldClass()} mt-1`}
            />
          </label>
          <label className="text-xs text-slate-500">
            Sampai
            <input
              type="date"
              value={custom.to}
              min={custom.from}
              onChange={(e) => setCustom({ ...custom, to: e.target.value })}
              className={`${fieldClass()} mt-1`}
            />
          </label>
        </div>
      )}

      {range.from && range.to && (
        <p className="text-sm text-slate-500">
          {formatDate(range.from)} – {formatDate(range.to)}
        </p>
      )}

      {error ? (
        <ErrorState
          message={error.message}
          onRetry={() => {
            cycle.refetch()
            overview.refetch()
          }}
        />
      ) : loading || !data ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : isEmpty ? (
        <EmptyState title="Belum ada transaksi" description="Tidak ada data di periode ini. Coba pilih periode lain." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">Pemasukan</p>
              <p className="mt-1 text-lg font-bold text-green-600">{formatRupiah(data.total_income)}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">Pengeluaran</p>
              <p className="mt-1 text-lg font-bold text-red-600">{formatRupiah(data.total_expense)}</p>
            </div>
          </div>

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-semibold text-slate-700">Pengeluaran per kategori</h2>
            {data.by_category.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Tidak ada pengeluaran di periode ini.</p>
            ) : (
              <CategoryDonut data={data.by_category} total={data.total_expense} />
            )}
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-semibold text-slate-700">Pengeluaran harian</h2>
            <DailyExpenseChart data={data.daily} />
          </section>
        </>
      )}
    </div>
  )
}
