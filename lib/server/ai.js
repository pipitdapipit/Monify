import 'server-only'
// SEMUA kode penyedia AI ada di file ini (Gemini & Anthropic), supaya mudah diganti.
// Pilih lewat .env: AI_PROVIDER, AI_MODEL, AI_API_KEY.
// Dipanggil lewat fetch biasa (tanpa SDK). Key hanya dikirim di header,
// dan tidak pernah dicetak ke log atau dimasukkan ke pesan error.
import { HttpError } from './errors.js'

// Batas waktu per model. Kalau lewat, model berikutnya di AI_MODEL dicoba.
const TIMEOUT_MS = 45_000

// Status yang berarti "penuh / sementara gagal" (529 = Anthropic overloaded).
const BUSY_STATUSES = [429, 500, 503, 504, 529]

function provider() {
  return (process.env.AI_PROVIDER || 'gemini').toLowerCase()
}

// AI_MODEL boleh berisi beberapa model dipisah koma, urut dari yang paling diutamakan.
// Model gratis sering penuh (503) bergantian; kalau satu penuh, model berikutnya dicoba.
function modelNames() {
  const list = (process.env.AI_MODEL || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (list.length > 0) return list
  return provider() === 'anthropic'
    ? ['claude-haiku-5-5']
    : ['gemini-3-flash-preview', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest']
}

// Error yang boleh dicoba ulang dengan model lain.
function retryable(status, message) {
  const err = new HttpError(status, message)
  err.retryable = true
  return err
}

// ---------------------------------------------------------------
// Pemanggil umum: kirim prompt + (opsional) gambar, terima objek JSON.
// schema = JSON Schema; dipakai fitur "structured output" milik penyedia.
// ---------------------------------------------------------------
async function generateJson({ system, user, schema, maxTokens, image }) {
  if (!process.env.AI_API_KEY) {
    console.error('AI_API_KEY belum diisi di .env.local')
    throw new HttpError(503, 'Fitur AI belum dikonfigurasi di server.')
  }
  const call = provider() === 'anthropic' ? callAnthropic : callGemini
  if (provider() !== 'anthropic' && provider() !== 'gemini') {
    throw new HttpError(503, 'AI_PROVIDER tidak dikenal. Pakai "gemini" atau "anthropic".')
  }
  let lastError
  for (const model of modelNames()) {
    try {
      return await call({ model, system, user, schema, maxTokens, image })
    } catch (err) {
      if (!err.retryable) throw err
      lastError = err
    }
  }
  throw lastError
}

// Ubah respons non-OK jadi error ramah user. Isi respons tidak dibawa ke user,
// tapi pesan error penyedia dicetak ke log (tidak memuat key) supaya mudah dilacak.
async function post(url, headers, body, model) {
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    console.error(`AI ${model}: tidak merespons dalam ${TIMEOUT_MS / 1000} dtk`)
    throw retryable(504, 'Layanan AI tidak merespons. Coba lagi.')
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    console.error(`AI ${model}: HTTP ${res.status} ${String(data?.error?.message || '').slice(0, 200)}`)
    if (BUSY_STATUSES.includes(res.status)) throw retryable(503, 'AI sedang sibuk. Coba lagi sebentar lagi.')
    // 404 = model tidak tersedia untuk key ini; model berikutnya masih bisa dicoba
    if (res.status === 404) throw retryable(502, 'Model AI tidak tersedia. Periksa AI_MODEL di .env.local.')
    throw new HttpError(502, 'Layanan AI sedang bermasalah. Coba lagi nanti.')
  }
  return res.json()
}

// Hasil model tidak dipercaya: kalau bukan JSON valid, minta user coba lagi.
function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(422, 'AI tidak bisa membaca struk ini. Coba foto yang lebih jelas.')
  }
}

// ---------------- Anthropic: paksa model memanggil satu "tool" berskema ----------------
async function callAnthropic({ model, system, user, schema, maxTokens, image }) {
  const content = []
  if (image) {
    content.push({ type: 'image', source: { type: 'base64', media_type: image.mime, data: image.buffer.toString('base64') } })
  }
  content.push({ type: 'text', text: user })

  const data = await post(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': process.env.AI_API_KEY, 'anthropic-version': '2023-06-01' },
    {
      model,
      max_tokens: maxTokens,
      temperature: 0,
      system,
      messages: [{ role: 'user', content }],
      tools: [{ name: 'save_result', description: 'Simpan hasil ekstraksi.', input_schema: schema }],
      tool_choice: { type: 'tool', name: 'save_result' },
    },
    model,
  )
  const block = data.content?.find((b) => b.type === 'tool_use')
  if (!block) throw new HttpError(422, 'AI tidak bisa membaca struk ini. Coba foto yang lebih jelas.')
  return block.input
}

// ---------------- Gemini: JSON mode + responseSchema ----------------
// Gemini memakai skema gaya OpenAPI: tipe huruf besar, dan "nullable: true".
function toGeminiSchema(schema) {
  const out = { ...schema }
  const types = [].concat(schema.type)
  if (types.includes('null')) out.nullable = true
  out.type = types.find((t) => t !== 'null').toUpperCase()
  if (schema.properties) {
    out.properties = Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, toGeminiSchema(v)]))
  }
  if (schema.items) out.items = toGeminiSchema(schema.items)
  delete out.additionalProperties
  return out
}

async function callGemini({ model, system, user, schema, maxTokens, image }) {
  const parts = [{ text: user }]
  if (image) parts.push({ inlineData: { mimeType: image.mime, data: image.buffer.toString('base64') } })

  const data = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { 'x-goog-api-key': process.env.AI_API_KEY }, // di header, bukan di URL
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(schema),
        // Ekstraksi sederhana tidak butuh "berpikir". Tanpa ini, token pemikiran bisa
        // menghabiskan maxOutputTokens sehingga jawaban terpotong (MAX_TOKENS).
        thinkingConfig: { thinkingLevel: 'minimal' },
      },
    },
    model,
  )
  // Model "thinking" bisa menaruh bagian pemikiran sebelum jawaban; ambil bagian jawabannya.
  const text = data.candidates?.[0]?.content?.parts?.find((p) => p.text && !p.thought)?.text
  if (!text) throw new HttpError(422, 'AI tidak bisa membaca struk ini. Coba foto yang lebih jelas.')
  return parseJson(text)
}

// ---------------------------------------------------------------
// Struk
// ---------------------------------------------------------------

// Bentuk JSON yang diminta dari model.
const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    merchant: { type: ['string', 'null'] },
    date: { type: ['string', 'null'] },
    total: { type: 'integer' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, qty: { type: 'integer' }, price: { type: 'integer' } },
        required: ['name', 'qty', 'price'],
      },
    },
    category_id: { type: ['string', 'null'] },
    wallet_id: { type: ['string', 'null'] },
    confidence: { type: 'number' },
  },
  required: ['merchant', 'date', 'total', 'items', 'category_id', 'wallet_id', 'confidence'],
}

// Prompt singkat (hemat token). Aturannya khusus struk Indonesia.
const RECEIPT_SYSTEM = `Kamu mengekstrak data dari struk belanja Indonesia. Balas HANYA JSON sesuai skema, tanpa penjelasan.
Aturan:
- total = jumlah akhir yang dibayar ("TOTAL", "GRAND TOTAL", "TOTAL BAYAR"). BUKAN subtotal, pajak (PPN), tunai, atau kembalian ("KEMBALI").
- Titik = pemisah ribuan: "25.000" = 25000, "1.250.000" = 1250000. Koma = desimal: "25.000,00" = 25000. Semua angka bilangan bulat rupiah.
- date: yyyy-mm-dd, dari dd/mm/yyyy atau dd-mm-yy. Jika tidak ada tanggal, pakai tanggal hari ini.
- merchant: nama toko, biasanya di baris atas.
- category_id: pilih dari daftar kategori, atau null. wallet_id: null, kecuali struk jelas menyebut metode bayar yang cocok dengan nama dompet (mis. GoPay, BCA).
- items: name, qty, price (price = harga total baris itu). Maksimal 30 item.
- Teks OCR bisa salah ketik atau terpotong. Jangan mengarang item atau angka. Turunkan confidence (0-1) kalau ragu.`

// Daftar pilihan ditulis "id|nama" saja, supaya prompt pendek.
function receiptContext({ today, categories, wallets }) {
  const list = (rows) => rows.map((r) => `${r.id}|${r.name}`).join('\n') || '(kosong)'
  return `Hari ini: ${today}\nKategori (id|nama):\n${list(categories)}\nDompet (id|nama):\n${list(wallets)}`
}

const RECEIPT_MAX_TOKENS = 600

// Jalur utama: kirim TEKS hasil OCR (bukan gambar).
export function parseReceiptText({ text, ...ctx }) {
  return generateJson({
    system: RECEIPT_SYSTEM,
    user: `${receiptContext(ctx)}\n\nTeks struk (hasil OCR):\n"""\n${text}\n"""`,
    schema: RECEIPT_SCHEMA,
    maxTokens: RECEIPT_MAX_TOKENS,
  })
}

// Cadangan (RECEIPT_VISION_FALLBACK=true): kirim GAMBAR ke model yang bisa melihat.
export function parseReceiptImage({ image, ...ctx }) {
  return generateJson({
    system: RECEIPT_SYSTEM,
    user: `${receiptContext(ctx)}\n\nStruk ada di gambar terlampir.`,
    schema: RECEIPT_SCHEMA,
    maxTokens: RECEIPT_MAX_TOKENS,
    image,
  })
}

// ---------------------------------------------------------------
// Kalimat bebas, mis. "makan siang 25rb gofood"
// ---------------------------------------------------------------

const TRANSACTION_SCHEMA = {
  type: 'object',
  properties: {
    amount: { type: 'integer' },
    type: { type: 'string', enum: ['income', 'expense'] },
    category_id: { type: ['string', 'null'] },
    wallet_id: { type: ['string', 'null'] },
    date: { type: ['string', 'null'] },
    note: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['amount', 'type', 'category_id', 'wallet_id', 'date', 'note', 'confidence'],
}

const TRANSACTION_SYSTEM = `Kamu mengubah kalimat pencatatan keuangan berbahasa Indonesia menjadi JSON sesuai skema. Balas HANYA JSON, tanpa penjelasan.
Aturan:
- amount: bilangan bulat rupiah. "25rb"/"25k"/"25 ribu" = 25000, "2jt"/"2 juta" = 2000000, "1,5jt" = 1500000, "25.000" = 25000. Jangan mengarang nominal; kalau tidak ada nominal, amount = 0.
- type: "expense" (makan, beli, bayar, belanja) atau "income" (gaji, bonus, terima, dapat, jual).
- category_id: pilih dari daftar, hanya yang jenisnya sama dengan type, atau null.
- wallet_id: dompet yang disebut atau jelas tersirat dari namanya (mis. gofood/gopay -> GoPay, bca -> BCA), atau null. Jangan menebak.
- date: yyyy-mm-dd. Tanpa keterangan waktu = hari ini. "kemarin" = hari ini dikurangi 1 hari.
- note: deskripsi singkat tanpa nominal (maks 60 huruf).
- confidence (0-1): turunkan kalau nominal, jenis, atau kategori tidak jelas.`

// Daftar kategori ditulis "id|nama|jenis" supaya model bisa mencocokkan jenisnya.
export function parseTransactionText({ text, today, categories, wallets }) {
  const cats = categories.map((c) => `${c.id}|${c.name}|${c.type}`).join('\n') || '(kosong)'
  const wals = wallets.map((w) => `${w.id}|${w.name}`).join('\n') || '(kosong)'
  return generateJson({
    system: TRANSACTION_SYSTEM,
    user: `Hari ini: ${today}\nKategori (id|nama|jenis):\n${cats}\nDompet (id|nama):\n${wals}\n\nKalimat:\n"""\n${text}\n"""`,
    schema: TRANSACTION_SCHEMA,
    maxTokens: 300,
  })
}
