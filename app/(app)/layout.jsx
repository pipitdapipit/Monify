'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import Spinner from '@/components/ui/Spinner'
import { useAuth } from '@/context/AuthContext'

// Halaman yang butuh login. Kalau belum login, lempar ke /login dan ingat halaman tujuan.
export default function ProtectedLayout({ children }) {
  const { user, checking } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!checking && !user) router.replace('/login?next=' + encodeURIComponent(pathname))
  }, [checking, user, pathname, router])

  if (checking || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return <AppLayout>{children}</AppLayout>
}
