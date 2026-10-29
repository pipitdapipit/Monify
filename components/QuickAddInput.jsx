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
    <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-sm">
      <Icon name="sparkles" className="ml-2 h-5 w-5 shrink-0 text-teal-600" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='Coba: "makan siang 25rb gofood"'
        aria-label="Catat transaksi cepat"
        disabled={disabled}
        className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-slate-400"
      />
      <Link
        href="/receipt"
        aria-label="Scan struk"
        className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
      >
        <Icon name="camera" className="h-5 w-5" />
      </Link>
      <button
        type="submit"
        aria-label="Kirim"
        disabled={disabled || !text.trim()}
        className="rounded-xl bg-teal-600 p-2 text-white disabled:bg-teal-300"
      >
        <Icon name="send" className="h-5 w-5" />
      </button>
    </form>
  )
}
