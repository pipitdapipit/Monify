# Migrasi Monify ke Next.js — Design

Tanggal: 2026-10-28

## Tujuan

Gabungkan `Monify/` (React + Vite SPA) dan `monify-backend/` (Express) menjadi **satu app Next.js**
yang di-deploy sekali ke Vercel. Tidak perlu Railway, CORS, atau dua set env lagi.

Kriteria berhasil:
- Semua fitur yang ada tetap jalan dengan tampilan sama: login/register, dashboard, tambah transaksi
  (manual + AI), scan struk (OCR + AI), daftar transaksi (filter, ubah, hapus), dompet, laporan,
  pengaturan, dark mode, mode mock.
- `next build` lolos; API AI bisa dipanggil dari halaman di domain yang sama.
- Database Supabase (skema, RLS, view, fungsi SQL) tidak berubah.

Di luar cakupan: desain ulang UI, perbaikan responsif mobile, PWA, auth berbasis cookie/SSR,
rate limit tersimpan di database.

## Lokasi

Project baru di `Portofolio/monify-next/`. Folder `Monify/` dan `monify-backend/` dibiarkan utuh
sebagai cadangan sampai migrasi dinyatakan selesai.

## Stack

Next.js 16 (App Router), JavaScript (bukan TypeScript), React 19, Tailwind CSS v4,
`@supabase/supabase-js`, `recharts`, `zod`, `@llamaindex/liteparse`.

## Struktur

```
app/
  layout.jsx                       root: <html>, font, metadata, ThemeProvider, AuthProvider, FlashProvider
  globals.css                      = Monify/src/index.css
  login/page.jsx, register/page.jsx
  (app)/layout.jsx                 client: cek login (pengganti ProtectedRoute) + AppLayout
  (app)/page.jsx                   Dashboard
  (app)/{add,receipt,transactions,wallets,reports,settings}/page.jsx
  api/health/route.js
  api/ai/parse-transaction/route.js
  api/ai/parse-receipt/route.js
components/  hooks/  context/  utils/        dari Monify/src (isi hampir tidak berubah)
lib/api/                                     dari Monify/src/api (client fetch, handler Supabase, mock)
lib/server/                                  dari monify-backend/src/services + utils, `import 'server-only'`
scripts/test-receipt.mjs                     dari monify-backend/scripts
supabase/                                    migration + schema.sql dari monify-backend
```

Isi halaman di `app/**/page.jsx` adalah komponen halaman lama (`'use client'`).

## Frontend

Perubahan hanya pada lapisan routing:

| Lama (react-router) | Baru (Next) |
|---|---|
| `<Link to>` | `next/link` `<Link href>` |
| `NavLink` + `isActive` | komponen `NavItem` dengan `usePathname()` |
| `useNavigate()` | `useRouter().push/replace` |
| `navigate(path, { state: { flash } })` | `useFlash().show(msg)` lalu `router.push(path)`; `FlashProvider` menampilkan toast 3 dtk |
| `<Navigate to="/login" state={{ from }}>` | `router.replace('/login?next=' + pathname)`; login membaca `next` dari `useSearchParams` (hanya path internal yang diawali `/`) |
| Dashboard → `navigate('/add', { state: { text } })` | `router.push('/add?text=' + encodeURIComponent(text))`; AddTransaction membaca `text` dari `useSearchParams`, lalu `router.replace('/add')` setelah dipakai |

- `import.meta.env.VITE_USE_MOCK` → `process.env.NEXT_PUBLIC_USE_MOCK`.
- `localStorage`/`window` hanya diakses di `useEffect` atau handler, supaya prerender tidak error.
- ThemeContext: kelas `dark` di `<html>` dipasang lewat skrip inline kecil di `<head>` supaya tidak
  berkedip saat halaman dimuat; `<html suppressHydrationWarning>`.
- `lib/api/client.js`: `BASE_URL` dihapus; `request()` memanggil path relatif `/api/ai/...`.
- Pesan "backend belum jalan" diganti pesan koneksi umum.

## Auth

Tetap seperti sekarang: supabase-js di browser, sesi di localStorage. Route handler membaca header
`Authorization: Bearer <token>`, memverifikasi lewat `supabase.auth.getUser(token)`, lalu membuat client
atas nama user (RLS berlaku). Tanpa secret / service_role key.

## API (Route Handlers)

Semua `export const runtime = 'nodejs'`.

- `GET /api/health` → `{ status: 'ok' }`.
- `POST /api/ai/parse-transaction` body `{ text }` (zod, 1–300 karakter) → objek transaksi.
- `POST /api/ai/parse-receipt` multipart field `image` → objek struk. `maxDuration = 60`.

Pembungkus bersama `withAuth(handler, { limiter })` di `lib/server/route.js`:
1. Verifikasi token (401 kalau gagal).
2. Rate limit per user (429).
3. Panggil handler; `HttpError` → `{ error }` dengan status-nya; error lain dicatat (nama + pesan saja)
   dan dibalas 500 "Terjadi kesalahan di server."

Upload: `request.formData()`, file wajib ada, maks 4 MB (`413`), tipe dicek dengan magic bytes
(`fileType.js`, `415`). Pengganti multer.

Logika AI (`ai.js`: daftar model fallback, `thinkingLevel: 'minimal'`, log error penyedia),
`receipt.js`, `transaction.js`, `userData.js`, `schemas.js`, `today.js`, `errors.js` dipindah tanpa
perubahan logika. `createUserClient` tidak perlu `ws` lagi (Node ≥ 22 punya WebSocket bawaan);
env memakai `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Rate limiting

Limiter di memori per instance (`lib/server/rateLimit.js`, Map + jendela 60 dtk, entri lama dibersihkan):
30 permintaan AI/menit dan 10 struk/menit per user id. Sifatnya usaha terbaik: di Vercel hitungan
tidak dibagi antar instance. Diterima untuk skala portofolio.

## OCR di Vercel (LiteParse)

- `next.config.mjs`: `serverExternalPackages: ['@llamaindex/liteparse']` dan
  `outputFileTracingIncludes` untuk route parse-receipt agar binary Linux + `libpdfium.so` ikut terbawa.
- File sementara di `os.tmpdir()` (`/tmp` di Vercel), selalu dihapus.
- **Batas body Vercel 4,5 MB**: halaman scan struk mengecilkan foto di browser (canvas, sisi terpanjang
  maks 1600 px, JPEG kualitas 0,85) sebelum upload. File kecil yang sudah di bawah batas tetap dikecilkan
  supaya konsisten.
- Risiko: LiteParse di Vercel baru terbukti setelah deploy. Cadangan: `RECEIPT_VISION_FALLBACK=true`.

## Env (`.env.local`, juga di dashboard Vercel)

```
NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
AI_PROVIDER=gemini
AI_MODEL=gemini-3-flash-preview,gemini-3.5-flash-lite,gemini-flash-lite-latest
AI_API_KEY=
# OCR_LANGUAGE=eng
RECEIPT_VISION_FALLBACK=false
```

Dihapus: `VITE_API_BASE_URL`, `CORS_ORIGIN`, `PORT`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.
`.env.local` di-ignore git; `.env.example` di-commit.

## Verifikasi

1. `next build` lolos tanpa error.
2. `scripts/test-receipt.mjs` dengan gambar struk contoh → JSON benar.
3. `next start` lalu uji HTTP: `/api/health` 200; endpoint AI tanpa token 401; dengan token asli
   (bila tersedia) parse-transaction dan parse-receipt 200; file bukan gambar 415.
4. Mode mock: buka semua halaman, cek navigasi (sidebar, bottom nav), redirect login → `?next`,
   flash setelah simpan, modal, dark mode tanpa kedip.
5. Setelah deploy (oleh user): scan struk di Vercel untuk memastikan LiteParse jalan.
