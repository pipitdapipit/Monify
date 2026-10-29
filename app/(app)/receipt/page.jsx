'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFlash } from '@/context/FlashContext'
import { resizeImage } from '@/utils/resizeImage'
import { parseReceipt } from '@/lib/api/ai'
import TransactionConfirmModal from '@/components/TransactionConfirmModal'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import Spinner from '@/components/ui/Spinner'

const MAX_SIZE_MB = 10

export default function ReceiptUpload() {
  const router = useRouter()
  const flash = useFlash()
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  // Hasil scan yang menunggu konfirmasi: { draft, receipt } atau null
  const [pending, setPending] = useState(null)

  // Buat URL sementara untuk pratinjau gambar, dan hapus lagi saat gambar diganti.
  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function handleFileChange(e) {
    const chosen = e.target.files?.[0]
    // Kosongkan input supaya file yang sama bisa dipilih lagi
    e.target.value = ''
    if (!chosen) return
    setError('')
    if (!chosen.type.startsWith('image/')) {
      setError('File harus berupa gambar (JPG, PNG, dll).')
      return
    }
    if (chosen.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Ukuran gambar maksimal ${MAX_SIZE_MB} MB.`)
      return
    }
    setFile(chosen)
  }

  async function handleProcess() {
    setParsing(true)
    setError('')
    try {
      // Kecilkan dulu di browser: upload lebih cepat dan di bawah batas 4 MB server
      const receipt = await parseReceipt(await resizeImage(file))
      setPending({
        receipt,
        // Ubah hasil struk jadi draft transaksi untuk modal konfirmasi
        draft: {
          type: 'expense',
          amount: receipt.total,
          category_id: receipt.suggested_category_id || '',
          wallet_id: '',
          date: receipt.date,
          note: receipt.merchant || '',
        },
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setParsing(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Scan Struk</h1>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        {previewUrl ? (
          <div className="relative overflow-hidden rounded-xl bg-slate-100">
            <img src={previewUrl} alt="Pratinjau struk" className="mx-auto max-h-96 object-contain" />
            {parsing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80">
                <Spinner />
                <p className="text-sm font-medium text-slate-700">Membaca struk...</p>
              </div>
            )}
          </div>
        ) : (
          <label
            htmlFor="receipt-file"
            className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-12 text-center hover:bg-slate-50"
          >
            <Icon name="camera" className="h-10 w-10 text-teal-600" />
            <span className="font-semibold">Foto atau pilih gambar struk</span>
            <span className="text-xs text-slate-500">Pastikan total belanja terlihat jelas</span>
          </label>
        )}

        {/* capture: di HP langsung membuka kamera belakang */}
        <input
          id="receipt-file"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {file && (
          <div className="mt-4 flex gap-2">
            <label
              htmlFor="receipt-file"
              className={`flex flex-1 cursor-pointer items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 ${
                parsing ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              Ganti gambar
            </label>
            <Button onClick={handleProcess} loading={parsing} className="flex-1">
              Proses struk
            </Button>
          </div>
        )}
      </div>

      <TransactionConfirmModal
        open={pending !== null}
        draft={pending?.draft}
        receipt={pending?.receipt}
        source="ai_receipt"
        onClose={() => setPending(null)}
        onSaved={() => {
          flash.show('Transaksi dari struk tersimpan.')
          router.push('/')
        }}
      />
    </div>
  )
}
