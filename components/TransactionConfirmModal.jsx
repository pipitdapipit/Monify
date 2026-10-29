'use client'

import { useState } from 'react'
import { createTransaction } from '@/lib/api/transactions'
import { formatRupiah } from '@/utils/formatRupiah'
import Modal from '@/components/ui/Modal'
import Icon from '@/components/ui/Icon'
import TransactionForm from '@/components/TransactionForm'

// Di bawah angka ini, hasil AI dianggap "kurang yakin" dan ditandai.
const LOW_CONFIDENCE = 0.7

// Modal konfirmasi untuk hasil AI (teks maupun struk).
// Hasil AI TIDAK langsung disimpan: user bisa mengubah semua field dulu.
//
// draft      : { type, amount, category_id, wallet_id, date, note }
// confidence : 0-1 dari AI teks (kosongkan untuk struk)
// receipt    : hasil scan struk, untuk menampilkan daftar item (opsional)
export default function TransactionConfirmModal({
  open,
  draft,
  confidence,
  receipt,
  source = 'ai_text', // 'ai_text' | 'ai_receipt': dicatat di database
  onClose,
  onSaved,
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const hasConfidence = typeof confidence === 'number'
  const isLowConfidence = hasConfidence && confidence < LOW_CONFIDENCE

  // Tandai field yang perlu dicek: semua tebakan AI kalau kurang yakin,
  // plus field yang kosong.
  const highlight = []
  if (isLowConfidence) highlight.push('amount', 'category_id', 'wallet_id')
  if (draft && !draft.amount) highlight.push('amount')
  if (draft && !draft.wallet_id) highlight.push('wallet_id')
  if (draft && !draft.category_id) highlight.push('category_id')

  function handleClose() {
    setError('')
    onClose()
  }

  async function handleSubmit(data) {
    setSaving(true)
    setError('')
    try {
      const saved = await createTransaction({ ...data, source })
      onSaved(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} title="Konfirmasi transaksi" onClose={saving ? undefined : handleClose}>
      {hasConfidence && (
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
          <Icon name="sparkles" className="h-3.5 w-3.5" />
          Keyakinan AI: {Math.round(confidence * 100)}%
        </p>
      )}

      {isLowConfidence && (
        <div className="mb-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <Icon name="alert" className="h-5 w-5 shrink-0" />
          <p>AI kurang yakin dengan hasil ini. Cek lagi kolom yang ditandai sebelum menyimpan.</p>
        </div>
      )}

      {receipt && (
        <details className="mb-4 rounded-xl bg-slate-50 p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            {receipt.merchant} · {receipt.items?.length || 0} item
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-slate-600">
            {receipt.items?.map((item, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate">{item.name}</span>
                <span className="shrink-0">{formatRupiah(item.price)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-semibold">
            <span>Total struk</span>
            <span>{formatRupiah(receipt.total)}</span>
          </p>
        </details>
      )}

      {/* Modal tidak merender apa pun saat tertutup, jadi form selalu
          mulai lagi dari draft terbaru setiap kali dibuka. */}
      <TransactionForm
        initial={draft}
        highlight={highlight}
        onSubmit={handleSubmit}
        onCancel={handleClose}
        submitting={saving}
        error={error}
        submitLabel="Simpan transaksi"
      />
    </Modal>
  )
}
