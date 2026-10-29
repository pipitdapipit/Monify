'use client'

import { useState } from 'react'
import { useCategories } from '@/hooks/useCategories'
import { useWallets } from '@/hooks/useWallets'
import { todayISO } from '@/utils/date'
import AmountInput from '@/components/AmountInput'
import Button from '@/components/ui/Button'
import Field, { fieldClass } from '@/components/ui/Field'

// Fungsi (bukan objek tetap) supaya tanggal default selalu hari ini.
function emptyTransaction() {
  return { type: 'expense', amount: 0, category_id: '', wallet_id: '', date: todayISO(), note: '' }
}

// Form transaksi yang dipakai di 3 tempat: input manual, modal konfirmasi AI,
// dan edit transaksi.
//
// initial   : nilai awal (boleh sebagian)
// highlight : daftar nama field yang perlu dicek user, mis. ['amount']
// onSubmit  : dipanggil dengan data yang sudah valid
export default function TransactionForm({
  initial,
  onSubmit,
  onCancel,
  submitting = false,
  error = '',
  submitLabel = 'Simpan',
  highlight = [],
}) {
  const [form, setForm] = useState(() => ({ ...emptyTransaction(), ...initial }))
  const [fieldErrors, setFieldErrors] = useState({})
  const { categories, loading: categoriesLoading } = useCategories()
  const { wallets, loading: walletsLoading } = useWallets()

  const categoryOptions = categories.filter((c) => c.type === form.type)

  function update(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  function changeType(type) {
    // Kategori pengeluaran tidak cocok untuk pemasukan, jadi kosongkan.
    const current = categories.find((c) => c.id === form.category_id)
    setForm((prev) => ({
      ...prev,
      type,
      category_id: current && current.type !== type ? '' : prev.category_id,
    }))
  }

  // Cek isian form saja (wajib diisi / format). Bukan hitungan keuangan.
  function validate() {
    const errors = {}
    if (!form.amount || form.amount <= 0) errors.amount = 'Nominal wajib diisi.'
    if (!form.category_id) errors.category_id = 'Pilih kategori.'
    if (!form.wallet_id) errors.wallet_id = 'Pilih dompet.'
    if (!form.date) errors.date = 'Tanggal wajib diisi.'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      type: form.type,
      amount: form.amount,
      category_id: form.category_id,
      wallet_id: form.wallet_id,
      date: form.date,
      note: form.note.trim(),
    })
  }

  const isHighlighted = (name) => highlight.includes(name)

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {/* Pilihan jenis: pengeluaran / pemasukan */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {[
          { value: 'expense', label: 'Pengeluaran', active: 'bg-white text-red-600 shadow-sm' },
          { value: 'income', label: 'Pemasukan', active: 'bg-white text-green-600 shadow-sm' },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => changeType(option.value)}
            className={`rounded-lg py-2 text-sm font-semibold ${
              form.type === option.value ? option.active : 'text-slate-500'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <Field label="Nominal" htmlFor="tx-amount" error={fieldErrors.amount} highlight={isHighlighted('amount')}>
        <AmountInput
          id="tx-amount"
          value={form.amount}
          onChange={(value) => update('amount', value)}
          error={fieldErrors.amount}
          highlight={isHighlighted('amount')}
        />
      </Field>

      <Field
        label="Kategori"
        htmlFor="tx-category"
        error={fieldErrors.category_id}
        highlight={isHighlighted('category_id')}
      >
        <select
          id="tx-category"
          value={form.category_id}
          onChange={(e) => update('category_id', e.target.value)}
          disabled={categoriesLoading}
          className={fieldClass(fieldErrors.category_id, isHighlighted('category_id'))}
        >
          <option value="">{categoriesLoading ? 'Memuat...' : 'Pilih kategori'}</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Dompet" htmlFor="tx-wallet" error={fieldErrors.wallet_id} highlight={isHighlighted('wallet_id')}>
        <select
          id="tx-wallet"
          value={form.wallet_id}
          onChange={(e) => update('wallet_id', e.target.value)}
          disabled={walletsLoading}
          className={fieldClass(fieldErrors.wallet_id, isHighlighted('wallet_id'))}
        >
          <option value="">{walletsLoading ? 'Memuat...' : 'Pilih dompet'}</option>
          {wallets.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Tanggal" htmlFor="tx-date" error={fieldErrors.date} highlight={isHighlighted('date')}>
        <input
          id="tx-date"
          type="date"
          value={form.date}
          onChange={(e) => update('date', e.target.value)}
          className={fieldClass(fieldErrors.date, isHighlighted('date'))}
        />
      </Field>

      <Field label="Catatan (opsional)" htmlFor="tx-note">
        <input
          id="tx-note"
          value={form.note}
          maxLength={120}
          onChange={(e) => update('note', e.target.value)}
          placeholder="mis. Makan siang"
          className={fieldClass()}
        />
      </Field>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={submitting} className="flex-1">
            Batal
          </Button>
        )}
        <Button type="submit" loading={submitting} className="flex-1">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
