'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTheme } from '@/context/ThemeContext'
import { formatCompactRupiah, formatRupiah } from '@/utils/formatRupiah'
import { formatDate } from '@/utils/date'

// Tooltip: tanggal lengkap + nominal
function DailyTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const day = payload[0].payload
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
      <p className="text-xs text-slate-500">{formatDate(day.date)}</p>
      <p className="font-semibold text-slate-800">{formatRupiah(day.expense)}</p>
    </div>
  )
}

// Grafik batang pengeluaran harian (data `daily` dari API).
// Hanya pengeluaran: gaji yang besar akan membuat batang lain tidak terbaca.
export default function DailyExpenseChart({ data }) {
  const { isDark } = useTheme()
  // Recharts memakai warna langsung, jadi dipilih manual sesuai tema
  const grid = isDark ? '#1e293b' : '#f1f5f9'
  const axis = isDark ? '#334155' : '#e2e8f0'
  const tick = isDark ? '#94a3b8' : '#64748b'

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={grid} />
          <XAxis
            dataKey="date"
            tickFormatter={(date) => Number(date.slice(8, 10))}
            tick={{ fontSize: 11, fill: tick }}
            tickLine={false}
            axisLine={{ stroke: axis }}
            minTickGap={8}
          />
          <YAxis
            tickFormatter={formatCompactRupiah}
            tick={{ fontSize: 11, fill: tick }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip content={<DailyTooltip />} cursor={{ fill: grid }} />
          <Bar dataKey="expense" fill="#e34948" radius={[4, 4, 0, 0]} maxBarSize={16} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
