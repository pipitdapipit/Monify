'use client'

import { useEffect } from 'react'
import Icon from '@/components/ui/Icon'

// Di mobile muncul dari bawah (bottom sheet), di desktop di tengah layar.
// onClose boleh dikosongkan (mis. saat sedang menyimpan) supaya modal tidak bisa ditutup.
export default function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return
    function handleKey(e) {
      if (e.key === 'Escape' && onClose) onClose()
    }
    document.addEventListener('keydown', handleKey)
    // Kunci scroll halaman di belakang modal
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:max-w-md md:rounded-3xl md:pb-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          {onClose && (
            <button onClick={onClose} aria-label="Tutup" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
              <Icon name="x" className="h-5 w-5" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}
