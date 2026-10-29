'use client'

import { useEffect, useState } from 'react'
import { getSettings, updateSettings } from '@/lib/api/settings'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useApi } from '@/hooks/useApi'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import Skeleton from '@/components/ui/Skeleton'
import ErrorState from '@/components/ui/ErrorState'
import Field, { fieldClass } from '@/components/ui/Field'

const themeOptions = [
  { value: 'light', label: 'Terang', icon: 'sun' },
  { value: 'dark', label: 'Gelap', icon: 'moon' },
  { value: 'system', label: 'Sistem', icon: 'computer' },
]

// [1, 2, ..., 31]
const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1)

export default function Settings() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { data, loading, error, refetch } = useApi(() => getSettings(), [])

  const [payday, setPayday] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [saveError, setSaveError] = useState('')

  // Isi pilihan dengan nilai dari API setelah termuat
  useEffect(() => {
    if (data) setPayday(String(data.payday_date))
  }, [data])

  const changed = data && Number(payday) !== data.payday_date

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    setSaveError('')
    try {
      await updateSettings({ ...data, payday_date: Number(payday) })
      setMessage('Tanggal gajian disimpan.')
      refetch()
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Pengaturan</h1>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-500">Masuk sebagai</p>
        <p className="font-semibold">{user?.name}</p>
        <p className="text-sm text-slate-500">{user?.email}</p>
      </div>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-medium text-slate-700">Tampilan</p>
        <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2">
          {themeOptions.map((option) => (
            <button
              key={option.value}
              role="radio"
              aria-checked={theme === option.value}
              onClick={() => setTheme(option.value)}
              className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-sm font-medium ${
                theme === option.value
                  ? 'border-teal-600 bg-teal-50 text-teal-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon name={option.icon} className="h-5 w-5" />
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        {error ? (
          <ErrorState message={error.message} onRetry={refetch} />
        ) : loading && !data ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <Field label="Tanggal gajian" htmlFor="payday">
              <select
                id="payday"
                value={payday}
                onChange={(e) => {
                  setPayday(e.target.value)
                  setMessage('')
                }}
                className={fieldClass()}
              >
                {dayOptions.map((day) => (
                  <option key={day} value={day}>
                    Tanggal {day}
                  </option>
                ))}
              </select>
            </Field>
            <p className="text-xs text-slate-500">
              Dipakai untuk menghitung siklus dan angka "Aman dipakai hari ini".
            </p>

            {message && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}
            {saveError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</p>}

            <Button type="submit" loading={saving} disabled={!changed}>
              Simpan
            </Button>
          </form>
        )}
      </section>

      <Button variant="secondary" onClick={logout} className="w-full text-red-600">
        <Icon name="logout" className="h-5 w-5" />
        Keluar
      </Button>
    </div>
  )
}
