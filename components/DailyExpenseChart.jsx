'use client'

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { formatRupiah } from '@/utils/formatRupiah'
import { formatDate } from '@/utils/date'

// Tooltip: tanggal lengkap + nominal
function DailyTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const day = payload[0].payload
  return (
    <div className="rounded-xl border border-line bg-raised px-3 py-2 text-sm">
      <p className="text-xs text-mute">{formatDate(day.date)}</p>
      <p className="font-semibold">{formatRupiah(day.expense)}</p>
    </div>
  )
}

// Grafik batang pengeluaran harian (data `daily` dari API).
// Hanya pengeluaran: gaji yang besar akan membuat batang lain tidak terbaca.
// Warna memakai token CSS, jadi otomatis mengikuti tema.
export default function DailyExpenseChart({ data }) {
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="date"
            tickFormatter={(date) => Number(date.slice(8, 10))}
            tick={{ fontSize: 11, fill: 'var(--mute)' }}
            tickLine={false}
            axisLine={false}
            minTickGap={8}
          />
          <Tooltip content={<DailyTooltip />} cursor={{ fill: 'var(--soft)' }} />
          <Bar dataKey="expense" fill="var(--acc)" radius={[4, 4, 0, 0]} maxBarSize={16} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
