import { formatRupiah } from '@/utils/formatRupiah'

// Satu baris transaksi. category dan wallet dikirim dari parent
// (hasil findCategory / findWallet), boleh kosong kalau belum termuat.
// `actions` opsional: tombol edit/hapus di halaman Transaksi.
// Pemasukan memakai warna aksen, pengeluaran warna teks biasa.
export default function TransactionItem({ transaction, category, wallet, actions }) {
  const isIncome = transaction.type === 'income'

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{transaction.note || category?.name || '-'}</p>
        <p className="truncate text-xs text-mute">
          {category?.name || 'Tanpa kategori'} · {wallet?.name || '-'}
        </p>
      </div>

      <p className={`shrink-0 text-sm font-medium ${isIncome ? 'text-acc' : ''}`}>
        {isIncome ? '+' : '−'}
        {formatRupiah(transaction.amount)}
      </p>

      {actions}
    </div>
  )
}
