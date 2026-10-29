'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useTheme } from '@/context/ThemeContext'
import { formatRupiah } from '@/utils/formatRupiah'

// Donut pengeluaran per kategori. Warna mengikuti kategori (dari API),
// bukan urutan, jadi warna "Makan" selalu sama di periode mana pun.
// Daftar di bawah donut berfungsi sebagai legenda sekaligus tabel angka.
export default function CategoryDonut({ data, total }) {
  const { isDark } = useTheme()
  // Recharts memakai warna langsung, jadi dipilih manual sesuai tema
  const surface = isDark ? '#121a2b' : '#ffffff'

  return (
    <div>
      <div className="relative h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="name"
              innerRadius="62%"
              outerRadius="90%"
              cornerRadius={4}
              stroke={surface}
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((item) => (
                <Cell key={item.category_id} fill={item.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [formatRupiah(value), name]}
              contentStyle={{
                borderRadius: 12,
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                background: surface,
                color: isDark ? '#e2e8f0' : '#1e293b',
                fontSize: 13,
              }}
              itemStyle={{ color: isDark ? '#e2e8f0' : '#1e293b' }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Angka di tengah donut: total pengeluaran dari API */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-slate-500">Total</span>
          <span className="text-base font-bold">{formatRupiah(total)}</span>
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {data.map((item) => (
          <li key={item.category_id} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="flex-1 truncate text-slate-700">{item.name}</span>
            <span className="font-semibold text-slate-800">{formatRupiah(item.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
