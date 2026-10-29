'use client'

import Link from 'next/link'
import { USE_MOCK } from '@/lib/api/client'
import Icon from '@/components/ui/Icon'
import BottomNav from '@/components/layout/BottomNav'
import Sidebar from '@/components/layout/Sidebar'

// Pesan flash (toast) ada di FlashProvider (context/FlashContext.jsx).
export default function AppLayout({ children }) {
  return (
    // md:pl-60 = beri ruang untuk sidebar (lebar 60) di desktop
    <div className="min-h-screen md:pl-60">
      <Sidebar />

      {/* Header hanya di mobile */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <span className="text-lg font-bold text-teal-700">Monify</span>
        <Link href="/settings" aria-label="Pengaturan" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
          <Icon name="settings" />
        </Link>
      </header>

      {/* pb-24 supaya konten tidak ketutup bottom nav di mobile */}
      <main className="mx-auto max-w-3xl px-4 pt-4 pb-24 md:px-8 md:pt-8 md:pb-8">
        {USE_MOCK && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-1.5 text-center text-xs text-amber-700">
            Mode demo: semua data adalah data contoh.
          </p>
        )}
        {children}
      </main>

      <BottomNav />
    </div>
  )
}
