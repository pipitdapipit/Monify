# Monify

Aplikasi pengelola uang untuk pengguna Indonesia.
Next.js (App Router), React 19, Tailwind CSS v4, Recharts, Supabase.

Satu app untuk front-end dan back-end:

- **Data** (akun, dompet, transaksi, ...) disimpan di Supabase dan diakses langsung
  dari browser dengan publishable key + RLS.
- **Fitur AI** (baca kalimat / struk) berjalan di Route Handlers `app/api/ai/*`
  di app yang sama. Key AI hanya ada di server.

## Menjalankan

Butuh Node.js 20.9 atau lebih baru.

```bash
npm install
cp .env.example .env.local    # Windows PowerShell: copy .env.example .env.local
# isi .env.local (lihat di bawah), lalu:
npm run dev
```

Buka http://localhost:3000.

Perintah lain:

- `npm run build`: build produksi
- `npm start`: jalankan hasil build
- `npm test`: tes unit (`node --test`, semua file `*.test.js`)
- `npm run test:receipt -- path/ke/struk.jpg`: uji OCR + AI pada satu gambar struk
  (mencetak teks OCR ke terminal; perlu `AI_API_KEY`)

## Variabel lingkungan

| Nama | Keterangan |
|---|---|
| `NEXT_PUBLIC_USE_MOCK` | `true` = data dummy di browser, tanpa Supabase. `false` = pakai Supabase. |
| `NEXT_PUBLIC_SUPABASE_URL` | URL project, mis. `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_...`). Aman di browser. |
| `AI_PROVIDER` | `gemini` atau `anthropic` |
| `AI_MODEL` | Satu atau beberapa model dipisah koma; kalau model pertama penuh, berikutnya dicoba. |
| `AI_API_KEY` | Key penyedia AI. **Hanya server**, jangan diberi prefix `NEXT_PUBLIC_`. |
| `OCR_LANGUAGE` | Opsional. Bahasa OCR Tesseract, default `eng`. |
| `RECEIPT_VISION_FALLBACK` | `true` = struk yang gagal dibaca OCR dikirim sebagai gambar ke model vision (lebih mahal). |

**Jangan taruh** secret key (`sb_secret_...` / `service_role`) atau connection
string database di sini. Semua variabel `NEXT_PUBLIC_*` terkirim ke browser.

## API

| Route | Keterangan |
|---|---|
| `GET /api/health` | `{ "status": "ok" }` |
| `POST /api/ai/parse-transaction` | body `{ text }` (1–300 karakter) → draft transaksi |
| `POST /api/ai/parse-receipt` | multipart, field `image` (JPG/PNG/WEBP, maks 4 MB) → hasil struk |

Route AI wajib header `Authorization: Bearer <access token Supabase>`. Token diperiksa
ke Supabase Auth, lalu query berjalan atas nama user itu (RLS berlaku).
Rate limit per user: 30 permintaan AI dan 10 struk per menit (di memori, per instance).

Halaman scan struk mengecilkan foto di browser (sisi terpanjang 1600 px, JPEG)
sebelum upload, supaya di bawah batas body Vercel 4,5 MB.

## Database

SQL ada di `supabase/migrations/`. Isinya: tabel, RLS, view `wallet_balances`,
fungsi `safe_to_spend()` dan `overview()`, serta kategori default. Terapkan lewat
Supabase SQL Editor atau `supabase db push`.

Front-end **tidak menghitung** saldo, safe-to-spend, atau ringkasan: semuanya
dihitung database dan hanya ditampilkan.

## Login & daftar

Supabase Auth (email + kata sandi), sesi disimpan di browser. Halaman di dalam
`app/(app)/` butuh login; kalau belum, user diarahkan ke `/login?next=<halaman>`
dan kembali ke sana setelah masuk.

## Mode mock

Dengan `NEXT_PUBLIC_USE_MOCK=true` semuanya memakai data palsu di browser:

- Login pakai email apa saja dan kata sandi minimal 6 karakter.
- Data contoh disimpan di `localStorage`. **Reset:** hapus key `monify_mock_db`.
- **Coba tampilan error:** `localStorage.setItem('monify_mock_fail', '1')` di console.
- Parser AI tiruan mengenali pola seperti `25rb`, `1,5jt`, `kemarin`, `gofood`, `bensin`.

## Deploy ke Vercel

1. Import repo ke Vercel (framework: Next.js).
2. Isi variabel lingkungan yang sama dengan `.env.local` di dashboard Vercel.
3. Deploy.

Catatan: OCR struk memakai LiteParse (binary Tesseract bawaan). Jalan di lokal, tapi
**belum terbukti di Vercel**. Setelah deploy, coba scan satu struk. Kalau gagal,
set `RECEIPT_VISION_FALLBACK=true` supaya struk dibaca lewat model vision.

## Struktur folder

```
app/
  layout.jsx            root: font, skrip tema, provider
  login/, register/     halaman publik
  (app)/                halaman yang butuh login (layout = cek login + navigasi)
  api/                  Route Handlers (health, ai/*)
components/             komponen yang dipakai ulang (form, modal, grafik, layout, ui/)
context/                AuthContext, ThemeContext, FlashContext (toast)
hooks/                  useApi, useCategories, useWallets
lib/api/                fungsi data untuk browser (Supabase / mock / fetch ke /api)
lib/server/             kode khusus server: AI, OCR, validasi, rate limit, auth route
utils/                  formatRupiah, tanggal, resizeImage, safeNext, ...
scripts/receipt-cli.mjs uji struk dari terminal
supabase/               migration + schema.sql
```
