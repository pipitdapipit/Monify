import { HttpError } from '@/lib/server/errors'
import { importScreenshot } from '@/lib/server/bankImport'
import { importMessage } from '@/lib/server/importMessage'
import { apiKeyStore } from '@/lib/server/importStores'
import { importLimiter } from '@/lib/server/rateLimit'
import { withApiKey } from '@/lib/server/route'

export const runtime = 'nodejs'
// OCR + AI bisa makan waktu
export const maxDuration = 60

// Batas body Vercel 4,5 MB; Shortcut mengubah screenshot ke JPEG dulu.
const MAX_BYTES = 4 * 1024 * 1024

// POST /api/import/bank-screenshot  (multipart, field "image"; Authorization: Bearer mnf_...)
// Dipanggil iPhone Shortcut. Respons selalu punya "message" untuk notifikasi.
export const POST = withApiKey(
  async (request, { key, supabase, lists }) => {
    const form = await request.formData().catch(() => {
      throw new HttpError(400, 'Upload gagal. Kirim 1 gambar di field "image".')
    })
    const file = form.get('image')
    if (!file || typeof file === 'string') throw new HttpError(400, 'Gambar belum dikirim (field "image").')
    if (file.size > MAX_BYTES) throw new HttpError(413, 'Ukuran gambar maksimal 4 MB.')

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await importScreenshot({ buffer, store: apiKeyStore(supabase, key), lists })
    return { ...result, message: importMessage(result) }
  },
  { limiter: importLimiter, limitMessage: 'Terlalu banyak screenshot. Coba lagi sebentar lagi.' },
)
