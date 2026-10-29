'use client'

import { useState } from 'react'
import { createWallet, updateWallet } from '@/lib/api/wallets'
import { useWallets } from '@/hooks/useWallets'
import { formatRupiah } from '@/utils/formatRupiah'
import { walletTypeIcon, walletTypeLabel, walletTypes } from '@/utils/labels'
import AmountInput from '@/components/AmountInput'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import Skeleton from '@/components/ui/Skeleton'
import ErrorState from '@/components/ui/ErrorState'
import EmptyState from '@/components/ui/EmptyState'
import Field, { fieldClass } from '@/components/ui/Field'

// Form tambah / ubah dompet. initial kosong = tambah baru.
function WalletForm({ initial, onSubmit, onCancel, submitting, error }) {
  const [name, setName] = useState(initial?.name || '')
  const [type, setType] = useState(initial?.type || 'cash')
  const [initialBalance, setInitialBalance] = useState(initial?.initial_balance || 0)
  const [nameError, setNameError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setNameError('Nama dompet wajib diisi.')
      return
    }
    onSubmit({ name: name.trim(), type, initial_balance: initialBalance })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="Nama dompet" htmlFor="wallet-name" error={nameError}>
        <input
          id="wallet-name"
          value={name}
          maxLength={40}
          onChange={(e) => {
            setName(e.target.value)
            setNameError('')
          }}
          placeholder="mis. BCA, GoPay, Dompet"
          className={fieldClass(nameError)}
        />
      </Field>

      <Field label="Jenis" htmlFor="wallet-type">
        <select id="wallet-type" value={type} onChange={(e) => setType(e.target.value)} className={fieldClass()}>
          {walletTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.icon} {t.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Saldo awal" htmlFor="wallet-balance">
        <AmountInput id="wallet-balance" value={initialBalance} onChange={setInitialBalance} />
        <p className="mt-1 text-xs text-slate-500">
          Saldo saat dompet mulai dicatat. Saldo sekarang dihitung otomatis dari transaksi.
        </p>
      </Field>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={submitting} className="flex-1">
          Batal
        </Button>
        <Button type="submit" loading={submitting} className="flex-1">
          Simpan
        </Button>
      </div>
    </form>
  )
}

export default function Wallets() {
  const { wallets, loading, error, refetch } = useWallets()
  // null = modal tertutup, {} = tambah baru, objek dompet = ubah
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  function openForm(wallet) {
    setSaveError('')
    setEditing(wallet)
  }

  async function handleSubmit(data) {
    setSaving(true)
    setSaveError('')
    try {
      if (editing.id) await updateWallet(editing.id, data)
      else await createWallet(data)
      setEditing(null)
      refetch()
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Dompet</h1>
        <Button onClick={() => openForm({})} className="py-2">
          <Icon name="plus" className="h-4 w-4" /> Tambah
        </Button>
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={refetch} />
      ) : loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : wallets.length === 0 ? (
        <EmptyState
          title="Belum ada dompet"
          description="Tambahkan rekening, e-wallet, atau uang tunai kamu."
          action={<Button onClick={() => openForm({})}>Tambah dompet</Button>}
        />
      ) : (
        <ul className="flex flex-col gap-3 md:grid md:grid-cols-2">
          {wallets.map((wallet) => (
            <li key={wallet.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-xl">
                {walletTypeIcon(wallet.type)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{wallet.name}</p>
                <p className="text-xs text-slate-500">{walletTypeLabel(wallet.type)}</p>
                <p className={`truncate font-bold ${wallet.balance < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                  {formatRupiah(wallet.balance)}
                </p>
              </div>
              <button
                onClick={() => openForm(wallet)}
                aria-label={`Ubah ${wallet.name}`}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <Icon name="pencil" className="h-5 w-5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editing !== null}
        title={editing?.id ? 'Ubah dompet' : 'Tambah dompet'}
        onClose={saving ? undefined : () => setEditing(null)}
      >
        <WalletForm
          initial={editing}
          onSubmit={handleSubmit}
          onCancel={() => setEditing(null)}
          submitting={saving}
          error={saveError}
        />
      </Modal>
    </div>
  )
}
