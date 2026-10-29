'use client'

import { useState } from 'react'
import Link from 'next/link'
import { deleteTransaction, getTransactions, updateTransaction } from '@/lib/api/transactions'
import { useApi } from '@/hooks/useApi'
import { useCategories } from '@/hooks/useCategories'
import { useWallets } from '@/hooks/useWallets'
import { formatDate, formatDateLabel, monthRange } from '@/utils/date'
import { formatRupiah } from '@/utils/formatRupiah'
import TransactionItem from '@/components/TransactionItem'
import TransactionForm from '@/components/TransactionForm'
import ConfirmDialog from '@/components/ConfirmDialog'
import Modal from '@/components/ui/Modal'
import Icon from '@/components/ui/Icon'
import Skeleton from '@/components/ui/Skeleton'
import ErrorState from '@/components/ui/ErrorState'
import EmptyState from '@/components/ui/EmptyState'
import { fieldClass } from '@/components/ui/Field'

// Filter awal: bulan ini, semua dompet & kategori.
function defaultFilters() {
  const now = new Date()
  return { ...monthRange(now.getFullYear(), now.getMonth()), wallet_id: '', category_id: '' }
}

// Kelompokkan daftar (yang sudah urut dari API) per tanggal untuk tampilan:
// [{ date: '2026-10-25', items: [...] }, ...]
function groupByDate(transactions) {
  const groups = []
  transactions.forEach((t) => {
    const last = groups[groups.length - 1]
    if (last && last.date === t.date) last.items.push(t)
    else groups.push({ date: t.date, items: [t] })
  })
  return groups
}

export default function Transactions() {
  const [filters, setFilters] = useState(defaultFilters)
  const [search, setSearch] = useState('')

  const { data, loading, error, refetch } = useApi(
    () => getTransactions(filters),
    [filters.from, filters.to, filters.wallet_id, filters.category_id],
  )
  const { categories, findCategory } = useCategories()
  const { wallets, findWallet } = useWallets()

  // Transaksi yang sedang diedit / akan dihapus
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  function updateFilter(name, value) {
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  // Pencarian teks dilakukan di sini, pada data yang sudah diambil.
  const keyword = search.trim().toLowerCase()
  const visible = (data || []).filter((t) => {
    if (!keyword) return true
    const categoryName = findCategory(t.category_id)?.name || ''
    return `${t.note} ${categoryName}`.toLowerCase().includes(keyword)
  })
  const groups = groupByDate(visible)
  const isFiltered = keyword || filters.wallet_id || filters.category_id

  async function handleEditSubmit(formData) {
    setSaving(true)
    setSaveError('')
    try {
      await updateTransaction(editing.id, formData)
      setEditing(null)
      refetch()
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleteLoading(true)
    setDeleteError('')
    try {
      await deleteTransaction(deleting.id)
      setDeleting(null)
      refetch()
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Transaksi</h1>
        <Link href="/add" className="flex items-center gap-1 text-sm font-semibold text-teal-700">
          <Icon name="plus" className="h-4 w-4" /> Tambah
        </Link>
      </div>

      {/* Filter */}
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari catatan atau kategori"
            aria-label="Cari transaksi"
            className={`${fieldClass()} pl-9`}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-500">
            Dari
            <input type="date" value={filters.from} max={filters.to} onChange={(e) => updateFilter('from', e.target.value)} className={`${fieldClass()} mt-1`} />
          </label>
          <label className="text-xs text-slate-500">
            Sampai
            <input type="date" value={filters.to} min={filters.from} onChange={(e) => updateFilter('to', e.target.value)} className={`${fieldClass()} mt-1`} />
          </label>
          <select aria-label="Filter dompet" value={filters.wallet_id} onChange={(e) => updateFilter('wallet_id', e.target.value)} className={fieldClass()}>
            <option value="">Semua dompet</option>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <select aria-label="Filter kategori" value={filters.category_id} onChange={(e) => updateFilter('category_id', e.target.value)} className={fieldClass()}>
            <option value="">Semua kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </div>

        {isFiltered && (
          <button
            onClick={() => {
              setFilters(defaultFilters())
              setSearch('')
            }}
            className="self-start text-sm font-medium text-teal-700"
          >
            Reset filter
          </button>
        )}
      </div>

      {/* Daftar */}
      {error ? (
        <ErrorState message={error.message} onRetry={refetch} />
      ) : loading ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          title={isFiltered ? 'Tidak ada yang cocok' : 'Belum ada transaksi'}
          description={
            isFiltered
              ? 'Coba ubah kata kunci atau filter.'
              : `Tidak ada transaksi ${formatDate(filters.from)} – ${formatDate(filters.to)}.`
          }
        />
      ) : (
        groups.map((group) => (
          <section key={group.date}>
            <h2 className="mb-1 px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              {formatDateLabel(group.date)}
            </h2>
            <div className="divide-y divide-slate-100 rounded-2xl bg-white px-4 shadow-sm">
              {group.items.map((t) => (
                <TransactionItem
                  key={t.id}
                  transaction={t}
                  category={findCategory(t.category_id)}
                  wallet={findWallet(t.wallet_id)}
                  actions={
                    <div className="flex shrink-0">
                      <button
                        onClick={() => {
                          setSaveError('')
                          setEditing(t)
                        }}
                        aria-label="Ubah transaksi"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Icon name="pencil" className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteError('')
                          setDeleting(t)
                        }}
                        aria-label="Hapus transaksi"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                    </div>
                  }
                />
              ))}
            </div>
          </section>
        ))
      )}

      <Modal open={editing !== null} title="Ubah transaksi" onClose={saving ? undefined : () => setEditing(null)}>
        <TransactionForm
          initial={editing}
          onSubmit={handleEditSubmit}
          onCancel={() => setEditing(null)}
          submitting={saving}
          error={saveError}
        />
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Hapus transaksi?"
        message={
          deleting
            ? `"${deleting.note || findCategory(deleting.category_id)?.name || 'Transaksi'}" sebesar ${formatRupiah(deleting.amount)} akan dihapus permanen.`
            : ''
        }
        loading={deleteLoading}
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
