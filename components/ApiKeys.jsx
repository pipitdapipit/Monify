'use client'

import { useEffect, useState } from 'react'
import { createApiKey, deleteApiKey, getApiKeys } from '@/lib/api/apiKeys'
import { USE_MOCK } from '@/lib/api/client'
import { useApi } from '@/hooks/useApi'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ConfirmDialog'
import ErrorState from '@/components/ui/ErrorState'
import Field, { fieldClass } from '@/components/ui/Field'
import Icon from '@/components/ui/Icon'
import Skeleton from '@/components/ui/Skeleton'

const ENDPOINT_PATH = '/api/import/bank-screenshot'

function formatTimestamp(ts) {
  return new Date(ts).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })
}

// Tombol salin dengan umpan balik singkat "Tersalin".
function CopyButton({ text, label = 'Salin' }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard ditolak browser: user masih bisa memilih teksnya manual
    }
  }
  return (
    <Button variant="secondary" onClick={copy} className="shrink-0 px-3 py-1.5 text-xs">
      {copied ? 'Tersalin' : label}
    </Button>
  )
}

// Pengaturan → "Shortcut iPhone": kelola personal API key + panduan pasang Shortcut.
export default function ApiKeys() {
  if (USE_MOCK) {
    return (
      <section className=" py-1">
        <p className="mb-1 text-sm font-medium text-slate-700">Shortcut iPhone</p>
        <p className="text-sm text-slate-500">Fitur ini hanya tersedia dengan Supabase.</p>
      </section>
    )
  }
  return <ApiKeysManager />
}

function ApiKeysManager() {
  const { data: keys, loading, error, refetch } = useApi(() => getApiKeys(), [])

  const [name, setName] = useState('iPhone')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [newKey, setNewKey] = useState('')

  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Dibaca di efek: komponen ini juga dirender saat prerender (tanpa window)
  const [endpoint, setEndpoint] = useState(ENDPOINT_PATH)
  useEffect(() => {
    setEndpoint(`${window.location.origin}${ENDPOINT_PATH}`)
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    try {
      const { key } = await createApiKey(name)
      setNewKey(key)
      refetch()
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteApiKey(toDelete.id)
      setToDelete(null)
      refetch()
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="flex flex-col gap-3 py-1">
      <div>
        <p className="text-sm font-medium text-slate-700">Shortcut iPhone</p>
        <p className="text-xs text-slate-500">
          Kirim screenshot aplikasi bank dari iPhone, transaksinya langsung tersimpan.
        </p>
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={refetch} />
      ) : loading && !keys ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12" />
        </div>
      ) : keys.length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada key.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-200">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{k.name}</p>
                <p className="truncate font-mono text-xs text-slate-500">{k.prefix}…</p>
                <p className="text-xs text-slate-500">
                  Dibuat {formatTimestamp(k.created_at)} ·{' '}
                  {k.last_used_at ? `Terakhir dipakai ${formatTimestamp(k.last_used_at)}` : 'Belum pernah dipakai'}
                </p>
              </div>
              <button
                onClick={() => {
                  setDeleteError('')
                  setToDelete(k)
                }}
                aria-label={`Hapus key ${k.name}`}
                className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Icon name="trash" className="h-5 w-5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {newKey ? (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-800">Simpan sekarang. Key ini tidak bisa dilihat lagi.</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-surface px-2 py-1.5 font-mono text-xs">{newKey}</code>
            <CopyButton text={newKey} />
          </div>
          <Button variant="ghost" onClick={() => setNewKey('')} className="self-end py-1.5 text-xs">
            Sudah disimpan
          </Button>
        </div>
      ) : (
        <form onSubmit={handleCreate} className="flex flex-col gap-2">
          <Field label="Nama key" htmlFor="api-key-name">
            <input
              id="api-key-name"
              value={name}
              maxLength={40}
              onChange={(e) => {
                setName(e.target.value)
                setCreateError('')
              }}
              className={fieldClass()}
            />
          </Field>
          {createError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</p>}
          <Button type="submit" variant="secondary" loading={creating} disabled={!name.trim()}>
            Buat key
          </Button>
        </form>
      )}

      <details className="text-sm text-slate-600">
        <summary className="cursor-pointer font-medium text-slate-700">Cara pasang di iPhone</summary>
        <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5">
          <li>
            Buka app <b>Shortcuts</b>, buat shortcut baru bernama &ldquo;Kirim ke Monify&rdquo;.
          </li>
          <li>
            Tambah <b>Take Screenshot</b>.
          </li>
          <li>
            Tambah <b>Convert Image</b> → format <b>JPEG</b> (supaya ukuran tetap kecil).
          </li>
          <li>
            Tambah <b>Get Contents of URL</b>:
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-slate-50 px-2 py-1.5 font-mono text-xs">
                {endpoint}
              </code>
              <CopyButton text={endpoint} />
            </div>
            <span className="mt-1 block">
              Method <b>POST</b>, Headers <code className="font-mono text-xs">Authorization</code> ={' '}
              <code className="font-mono text-xs">Bearer &lt;key kamu&gt;</code>, Request Body <b>Form</b>, field{' '}
              <b>File</b> bernama <code className="font-mono text-xs">image</code> = hasil Convert Image.
            </span>
          </li>
          <li>
            Tambah <b>Get Dictionary Value</b> untuk key <code className="font-mono text-xs">message</code>, lalu{' '}
            <b>Show Notification</b> dengan nilainya.
          </li>
          <li>
            Buka <b>Settings → Accessibility → Touch → Back Tap → Double Tap</b>, pilih &ldquo;Kirim ke
            Monify&rdquo;.
          </li>
        </ol>
      </details>

      <ConfirmDialog
        open={!!toDelete}
        title={toDelete ? `Hapus key "${toDelete.name}"?` : ''}
        message="Shortcut yang memakai key ini akan langsung ditolak."
        loading={deleting}
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </section>
  )
}
