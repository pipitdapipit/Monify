'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

// Kotak ketik cepat: "makan siang 25rb gofood".
// Teksnya dikirim ke parent lewat onSubmit; parent yang memanggil AI.
export default function QuickAddInput({ onSubmit, disabled = false }) {
  const [text, setText] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    onSubmit(value)
    setText('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1 rounded-full border-[1.5px] border-ink bg-surface py-1 pr-1 pl-4">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Catat, misalnya kopi 25rb"
        aria-label="Catat transaksi cepat"
        disabled={disabled}
        className="min-w-0 flex-1 bg-transparent py-1.5 text-base outline-none placeholder:text-mute"
      />
      {text.trim() ? (
        <button type="submit" aria-label="Kirim" disabled={disabled} className="rounded-full bg-acc p-2 text-on-acc">
          <Icon name="send" className="h-4 w-4" />
        </button>
      ) : (
        <Link href="/receipt" aria-label="Scan struk" className="rounded-full p-2 text-mute hover:bg-soft">
          <Icon name="camera" className="h-5 w-5" />
        </Link>
      )}
    </form>
  )
}
