'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { USE_MOCK } from '@/lib/api/client'
import Contour from '@/components/Contour'
import BottomNav from '@/components/layout/BottomNav'
import Sidebar from '@/components/layout/Sidebar'

// Pesan flash (toast) ada di FlashProvider (context/FlashContext.jsx).
export default function AppLayout({ children }) {
  const pathname = usePathname()
  // Beranda punya dua kolom di desktop, halaman lain satu kolom supaya mudah dibaca
  const width = pathname === '/' ? 'max-w-5xl' : 'max-w-2xl'

  return (
    // md:pl-52 = beri ruang untuk sidebar di desktop
    <div className="min-h-screen md:pl-52">
      <Contour />
      <Sidebar />

      {/* Header hanya di mobile */}
      <header className="relative z-10 flex items-center justify-between px-5 pt-5 pb-1 md:hidden">
        <Link href="/" className="font-extrabold tracking-tight">
          Monify
        </Link>
        <Link href="/settings" className="text-sm text-mute">
          Atur
        </Link>
      </header>

      {/* pb-24 supaya konten tidak ketutup bottom nav di mobile */}
      <main className={`relative mx-auto ${width} px-5 pt-4 pb-24 md:px-10 md:pt-10 md:pb-10`}>
        {USE_MOCK && (
          <p className="relative mb-4 rounded-lg bg-amber-50 px-3 py-1.5 text-center text-xs text-amber-700">
            Mode demo: semua data adalah data contoh.
          </p>
        )}
        {children}
      </main>

      <BottomNav />
    </div>
  )
}
