'use client'

import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'

export default function ErrorState({ message = 'Gagal memuat data.', onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
      <Icon name="alert" className="h-8 w-8 text-red-500" />
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Coba lagi
        </Button>
      )}
    </div>
  )
}
