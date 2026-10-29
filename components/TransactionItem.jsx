import { formatRupiah } from '@/utils/formatRupiah'

// Satu baris transaksi. category dan wallet dikirim dari parent
// (hasil findCategory / findWallet), boleh kosong kalau belum termuat.
// `actions` opsional: tombol edit/hapus di halaman Transaksi.
export default function TransactionItem({ transaction, category, wallet, actions }) {
  const isIncome = transaction.type === 'income'

  return (
    <div className="flex items-center gap-3 py-3">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
        style={{ backgroundColor: `${category?.color || '#64748b'}1a` }}
      >
        {category?.icon || '📦'}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{transaction.note || category?.name || '-'}</p>
        <p className="truncate text-xs text-slate-500">
          {category?.name || 'Tanpa kategori'} · {wallet?.name || '-'}
        </p>
      </div>

      <p className={`shrink-0 text-sm font-semibold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
        {isIncome ? '+' : '-'}
        {formatRupiah(transaction.amount)}
      </p>

      {actions}
    </div>
  )
}
