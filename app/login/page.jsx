'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { safeNext } from '@/utils/safeNext'
import { USE_MOCK } from '@/lib/api/client'
import { useAuth } from '@/context/AuthContext'
import AuthCard from '@/components/AuthCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

function Login() {
  const { user, login } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  // Halaman yang tadi mau dibuka sebelum dilempar ke login (hanya path internal)
  const from = safeNext(searchParams.get('next'))

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Sudah login: langsung ke tujuan
  useEffect(() => {
    if (user) router.replace(from)
  }, [user, from, router])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      router.replace(from)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title="Masuk" subtitle="Kelola uangmu dengan lebih tenang.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Kata sandi"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" loading={loading} className="w-full">
          Masuk
        </Button>
      </form>

      {USE_MOCK && (
        <p className="mt-4 text-center text-xs text-slate-400">
          Mode demo: email apa saja + kata sandi minimal 6 karakter.
        </p>
      )}

      <p className="mt-6 text-center text-sm text-slate-600">
        Belum punya akun?{' '}
        <Link href="/register" className="font-semibold text-teal-700">
          Daftar
        </Link>
      </p>
    </AuthCard>
  )
}

// useSearchParams butuh <Suspense> supaya halaman bisa di-prerender
export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  )
}
