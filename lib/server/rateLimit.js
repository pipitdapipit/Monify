import 'server-only'

// Pembatas sederhana di memori: maks `limit` permintaan per key dalam `windowMs`.
// Usaha terbaik: di Vercel tiap instance punya hitungan sendiri.
export function createLimiter({ limit, windowMs }) {
  const hits = new Map() // key -> { count, resetAt }

  return function allow(key) {
    const now = Date.now()
    // Buang entri yang jendelanya sudah lewat, supaya Map tidak terus membesar
    for (const [k, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(k)
    }
    const entry = hits.get(key)
    if (!entry) {
      hits.set(key, { count: 1, resetAt: now + windowMs })
      return true
    }
    entry.count += 1
    return entry.count <= limit
  }
}

// Per user (bukan per IP). Struk lebih mahal (OCR + AI), jadi lebih ketat.
export const aiLimiter = createLimiter({ limit: 30, windowMs: 60 * 1000 })
export const receiptLimiter = createLimiter({ limit: 10, windowMs: 60 * 1000 })
