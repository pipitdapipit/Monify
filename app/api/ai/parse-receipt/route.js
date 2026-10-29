import { HttpError } from '@/lib/server/errors'
import { detectImageType } from '@/lib/server/fileType'
import { receiptLimiter } from '@/lib/server/rateLimit'
import { parseReceipt } from '@/lib/server/receipt'
import { withAuth } from '@/lib/server/route'
import { loadUserLists } from '@/lib/server/userData'

export const runtime = 'nodejs'
// OCR + AI bisa makan waktu
export const maxDuration = 60

// Batas body Vercel 4,5 MB; browser sudah mengecilkan foto sebelum upload.
const MAX_BYTES = 4 * 1024 * 1024

// POST /api/ai/parse-receipt  (multipart, field "image")
export const POST = withAuth(
  async (request, { supabase }) => {
    const form = await request.formData().catch(() => {
      throw new HttpError(400, 'Upload gagal. Kirim 1 gambar di field "image".')
    })
    const file = form.get('image')
    if (!file || typeof file === 'string') throw new HttpError(400, 'Gambar belum dikirim (field "image").')
    if (file.size > MAX_BYTES) throw new HttpError(413, 'Ukuran gambar maksimal 4 MB.')

    // Jenis file dicek dari magic bytes, bukan dari nama / tipe yang dikirim user
    const buffer = Buffer.from(await file.arrayBuffer())
    const type = detectImageType(buffer)
    if (!type) throw new HttpError(415, 'File bukan gambar JPG, PNG, atau WEBP yang valid.')

    const lists = await loadUserLists(supabase)
    return parseReceipt({ buffer, type, lists })
  },
  { limiter: receiptLimiter, limitMessage: 'Terlalu banyak scan struk. Coba lagi sebentar lagi.' },
)
