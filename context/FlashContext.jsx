'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const FlashContext = createContext(null)

// Pesan singkat (toast) yang tetap tampil setelah pindah halaman, mis.
// flash.show('Transaksi tersimpan.') lalu router.push('/')
export function FlashProvider({ children }) {
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 3000)
    return () => clearTimeout(timer)
  }, [message])

  const show = useCallback((text) => setMessage(text), [])

  return (
    <FlashContext.Provider value={{ show }}>
      {children}
      {message && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-sm rounded-xl bg-neutral-800 px-4 py-3 text-center text-sm text-white shadow-lg md:bottom-8"
        >
          {message}
        </div>
      )}
    </FlashContext.Provider>
  )
}

export function useFlash() {
  return useContext(FlashContext)
}
