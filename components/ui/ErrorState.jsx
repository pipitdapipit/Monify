'use client'

import Button from '@/components/ui/Button'

export default function ErrorState({ message = 'Gagal memuat data.', onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <p className="text-sm text-red-600">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Coba lagi
        </Button>
      )}
    </div>
  )
}
