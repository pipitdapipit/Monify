import { HttpError } from '@/lib/server/errors'
import { aiLimiter } from '@/lib/server/rateLimit'
import { withAuth } from '@/lib/server/route'
import { parseTransactionBody } from '@/lib/server/schemas'
import { parseTransaction } from '@/lib/server/transaction'
import { loadUserLists } from '@/lib/server/userData'

export const runtime = 'nodejs'

// POST /api/ai/parse-transaction  body: { text }  (maks 300 karakter)
export const POST = withAuth(
  async (request, { supabase }) => {
    const raw = await request.json().catch(() => {
      throw new HttpError(400, 'JSON tidak valid.')
    })
    const body = parseTransactionBody.safeParse(raw)
    if (!body.success) throw new HttpError(400, 'Teks wajib diisi, maksimal 300 karakter.')

    const lists = await loadUserLists(supabase)
    return parseTransaction({ text: body.data.text, lists })
  },
  { limiter: aiLimiter, limitMessage: 'Terlalu banyak permintaan AI. Coba lagi sebentar lagi.' },
)
