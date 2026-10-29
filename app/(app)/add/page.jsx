'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useFlash } from '@/context/FlashContext'
import { parseTransaction } from '@/lib/api/ai'
import { createTransaction } from '@/lib/api/transactions'
import TransactionConfirmModal from '@/components/TransactionConfirmModal'
import TransactionForm from '@/components/TransactionForm'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'

const examples = ['makan siang 25rb gofood', 'bensin 30rb kemarin', 'gaji 7,5jt', 'token listrik 200rb bca']

function AddTransaction() {
  const router = useRouter()
  const flash = useFlash()
  const searchParams = useSearchParams()
  // Teks dari kotak cepat di Beranda (kalau ada), lewat ?text=
  const textFromDashboard = searchParams.get('text') || ''

  const [mode, setMode] = useState('ai') // 'ai' | 'manual'
  const [text, setText] = useState(textFromDashboard)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  // Hasil AI yang menunggu konfirmasi: { draft, confidence } atau null
  const [pending, setPending] = useState(null)

  const [savingManual, setSavingManual] = useState(false)
  const [manualError, setManualError] = useState('')

  async function runParse(value) {
    setParsing(true)
    setParseError('')
    try {
      const { confidence, ...draft } = await parseTransaction(value)
      // Backend memakai null untuk "tidak diketahui"; form memakai '' (belum dipilih)
      setPending({
        draft: { ...draft, category_id: draft.category_id ?? '', wallet_id: draft.wallet_id ?? '' },
        confidence,
      })
    } catch (err) {
      setParseError(err.message)
    } finally {
      setParsing(false)
    }
  }

  // Kalau datang dari Beranda, langsung proses teksnya sekali.
  // useRef menjaga agar tidak terpanggil dua kali (StrictMode menjalankan effect 2x saat dev).
  const autoParsed = useRef(false)
  useEffect(() => {
    if (textFromDashboard && !autoParsed.current) {
      autoParsed.current = true
      // Hapus ?text= dari alamat supaya refresh halaman tidak memproses ulang
      router.replace('/add')
      runParse(textFromDashboard)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleParseSubmit(e) {
    e.preventDefault()
    if (text.trim()) runParse(text.trim())
  }

  function handleSaved() {
    flash.show('Transaksi tersimpan.')
    router.push('/')
  }

  async function handleManualSubmit(data) {
    setSavingManual(true)
    setManualError('')
    try {
      await createTransaction(data)
      handleSaved()
    } catch (err) {
      setManualError(err.message)
    } finally {
      setSavingManual(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Tambah Transaksi</h1>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200/60 p-1">
        {[
          { value: 'ai', label: '✨ Ketik bebas' },
          { value: 'manual', label: 'Isi manual' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setMode(tab.value)}
            className={`rounded-lg py-2 text-sm font-semibold ${
              mode === tab.value ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === 'ai' ? (
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
          <form onSubmit={handleParseSubmit} className="flex flex-col gap-3">
            <label htmlFor="ai-text" className="text-sm font-medium text-slate-700">
              Tulis transaksimu seperti chat biasa
            </label>
            <textarea
              id="ai-text"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="mis. makan siang 25rb gofood"
              disabled={parsing}
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-500"
            />

            <div className="flex flex-wrap gap-2">
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setText(example)}
                  disabled={parsing}
                  className="rounded-full bg-teal-50 px-3 py-1 text-xs text-teal-700 hover:bg-teal-100"
                >
                  {example}
                </button>
              ))}
            </div>

            {parseError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{parseError}</p>}

            <Button type="submit" loading={parsing} disabled={!text.trim()}>
              {parsing ? 'AI sedang membaca...' : 'Proses dengan AI'}
            </Button>
          </form>

          <Link
            href="/receipt"
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Icon name="camera" className="h-5 w-5" />
            Atau scan struk belanja
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <TransactionForm onSubmit={handleManualSubmit} submitting={savingManual} error={manualError} />
        </div>
      )}

      <TransactionConfirmModal
        open={pending !== null}
        draft={pending?.draft}
        confidence={pending?.confidence}
        onClose={() => setPending(null)}
        onSaved={handleSaved}
      />
    </div>
  )
}

// useSearchParams butuh <Suspense> supaya halaman bisa di-prerender
export default function AddTransactionPage() {
  return (
    <Suspense>
      <AddTransaction />
    </Suspense>
  )
}
