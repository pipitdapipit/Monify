import { formatRupiah } from '@/utils/formatRupiah'

// Pengeluaran per kategori sebagai batang tebal, terbesar di atas.
// Panjang batang relatif terhadap kategori terbesar.
export default function CategoryBars({ data }) {
  const sorted = [...data].sort((a, b) => b.total - a.total)
  const max = sorted[0]?.total || 1

  return (
    <ul className="flex flex-col gap-3">
      {sorted.map((item) => (
        <li key={item.category_id}>
          <div className="flex justify-between gap-3 text-sm font-medium">
            <span className="truncate">{item.name}</span>
            <span className="shrink-0">{formatRupiah(item.total)}</span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-soft">
            <div className="h-full rounded-full bg-acc" style={{ width: `${Math.max((item.total / max) * 100, 2)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
