'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AuthCard from '@/components/AuthCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function Register() {
  const { user, register } = useAuth()
  const router = useRouter()

  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  // Sudah login: langsung ke Beranda
  useEffect(() => {
    if (user) router.replace('/')
  }, [user, router])

  // Satu handler untuk semua input, pakai atribut name
  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) {
      setError('Kata sandi minimal 6 karakter.')
      return
    }
    setLoading(true)
    try {
      const result = await register(form.name, form.email, form.password)
      // Supabase bisa meminta konfirmasi email dulu sebelum akun aktif
      if (result?.needsConfirmation) {
        setInfo('Akun dibuat. Cek email kamu untuk konfirmasi, lalu masuk.')
        return
      }
      router.replace('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title="Buat akun" subtitle="Mulai catat keuanganmu hari ini.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Nama" name="name" required autoComplete="name" value={form.name} onChange={handleChange} />
        <Input
          label="Email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={handleChange}
        />
        <Input
          label="Kata sandi"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          value={form.password}
          onChange={handleChange}
        />

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {info && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{info}</p>}

        <Button type="submit" loading={loading} className="w-full">
          Daftar
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Sudah punya akun?{' '}
        <Link href="/login" className="font-semibold text-teal-700">
          Masuk
        </Link>
      </p>
    </AuthCard>
  )
}
