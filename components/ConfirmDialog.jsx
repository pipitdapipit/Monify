'use client'

import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

// Dialog "Yakin?" sederhana, mis. sebelum menghapus.
export default function ConfirmDialog({ open, title, message, confirmLabel = 'Hapus', loading, error, onConfirm, onCancel }) {
  return (
    <Modal open={open} title={title} onClose={loading ? undefined : onCancel}>
      <p className="text-sm text-slate-600">{message}</p>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={loading} className="flex-1">
          Batal
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading} className="flex-1">
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
