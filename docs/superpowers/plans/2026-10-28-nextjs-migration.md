# Migrasi Monify ke Next.js — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Satu app Next.js di `Portofolio/monify-next/` yang menggantikan `Monify/` (Vite SPA) dan `monify-backend/` (Express), fitur dan tampilan sama.

**Architecture:** App Router; semua halaman `'use client'` (data diambil di browser lewat supabase-js seperti sekarang). Backend Express menjadi Route Handlers di `app/api/**` yang memakai kode service lama di `lib/server/`. Satu `.env.local`.

**Tech Stack:** Next.js 16.4, React 19, Tailwind v4 (`@tailwindcss/postcss`), supabase-js, recharts, zod, @llamaindex/liteparse. Tes server: `node --test` bawaan.

**Spec:** `docs/superpowers/specs/2026-10-28-nextjs-migration-design.md`

Sumber lama: `F = ../Monify/src`, `B = ../monify-backend/src`.

## Global Constraints

- JavaScript (`.js`/`.jsx`), bukan TypeScript. Komentar bahasa Indonesia, gaya sama dengan kode lama.
- Folder `Monify/` dan `monify-backend/` tidak diubah.
- Tidak ada secret / service_role key. Key AI hanya di server (tanpa prefix `NEXT_PUBLIC_`).
- Env: `NEXT_PUBLIC_USE_MOCK`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, `OCR_LANGUAGE`, `RECEIPT_VISION_FALLBACK`.
- Rate limit: 30 AI/menit, 10 struk/menit per user, di memori.
- Upload struk: maks 4 MB di server; browser mengecilkan ke sisi terpanjang 1600 px, JPEG 0,85.
- Route AI: `runtime = 'nodejs'`; parse-receipt `maxDuration = 60`.
- Deploy ke Vercel di luar cakupan plan ini.

## Review Focus

1. Refresh langsung di URL dalam (mis. `/transactions`) saat belum login → harus ke `/login?next=/transactions`, lalu kembali ke sana setelah login. (Task 5)
2. `?next=` berisi URL luar (`https://evil.com`, `//evil.com`) → diabaikan, ke `/`. (Task 5, `safeNext`)
3. Tema gelap tersimpan → halaman pertama tidak berkedip putih, tidak ada hydration error di console. (Task 4)
4. Upload file bukan gambar yang diberi ekstensi `.jpg` → 415, bukan crash. (Task 3)
5. Token kedaluwarsa saat memanggil AI → 401 → user dikeluarkan ke login. (Task 3 + Task 4 `setUnauthorizedHandler`)

---

### Task 1: Scaffold project

**Files:**
- Create: `package.json`, `next.config.mjs`, `postcss.config.mjs`, `jsconfig.json`, `.gitignore`, `.env.example`, `.env.local`, `app/layout.jsx`, `app/page.jsx` (sementara), `app/globals.css`, `public/favicon.svg`, `supabase/**`

- [ ] **Step 1:** `package.json` dengan `"type": "module"`, scripts `dev`, `build`, `start`, `test` (`node --conditions=react-server --test lib/server/`), `test:receipt` (`node --conditions=react-server --env-file=.env.local scripts/test-receipt.mjs`). Install dependency di Tech Stack + `server-only`.
- [ ] **Step 2:** `next.config.mjs`: `serverExternalPackages: ['@llamaindex/liteparse']`, `outputFileTracingIncludes: { '/api/ai/parse-receipt': ['./node_modules/@llamaindex/liteparse*/**/*'] }`. `jsconfig.json`: alias `@/*` → `./*`.
- [ ] **Step 3:** `app/globals.css` = `F/index.css` (font Inter lewat `next/font/google`, variabel `--font-inter`). Salin `public/favicon.svg` dan `supabase/` dari backend.
- [ ] **Step 4:** `.env.example` sesuai spec. `.env.local` dibuat dari dua `.env` lama lewat skrip (nilai tidak dicetak).
- [ ] **Step 5:** Verifikasi: `npm run build` → sukses.
- [ ] **Step 6:** `git init`, commit `chore: scaffold Next.js app`.

### Task 2: Port server library + rate limiter

**Files:**
- Create: `lib/server/{errors,schemas,today,fileType,ai,ocr,receipt,transaction,userData,supabase,rateLimit}.js`
- Create: `scripts/test-receipt.mjs`
- Test: `lib/server/rateLimit.test.js`, `lib/server/fileType.test.js`, `lib/server/receipt.test.js`

**Interfaces:**
- Produces: `createLimiter({ limit, windowMs }) → (key: string) => boolean` (true = boleh); `aiLimiter`, `receiptLimiter`; `createUserClient(token)`; `parseTransaction({ text, lists })`; `parseReceipt({ buffer, type, lists })`; `loadUserLists(supabase)`; `detectImageType(buffer) → { ext, mime } | null`; `HttpError(status, message)`; `parseTransactionBody` (zod).

- [ ] **Step 1: Tes gagal**
  - `rateLimit.test.js`: limiter `{limit: 2, windowMs: 1000}` → key `u1`: true, true, false; key `u2`: true; setelah jendela lewat (pakai `Date.now` yang di-mock) `u1` true lagi.
  - `fileType.test.js`: magic bytes JPEG/PNG/WEBP → ext `.jpg`/`.png`/`.webp`; teks `"hello"` → null.
  - `receipt.test.js`: `validDateOrToday('2026-02-30', '2026-10-28') === '2026-10-28'`; tanggal masa depan → today; `cleanReceipt` dengan `category_id` asing → `suggested_category_id: null`.
- [ ] **Step 2:** `npm test` → FAIL (modul belum ada).
- [ ] **Step 3:** Salin file B tanpa ubah logika, dengan `import 'server-only'` di baris atas. `supabase.js`: pakai env `NEXT_PUBLIC_SUPABASE_*`, tanpa opsi `realtime.transport`/`ws`. Tulis `rateLimit.js` (Map key → `{count, resetAt}`, entri kedaluwarsa dibuang saat dicek). Salin `scripts/test-receipt.mjs`.
- [ ] **Step 4:** `npm test` → PASS. `npm run test:receipt -- <struk.png>` → JSON dengan `total` benar.
- [ ] **Step 5:** Commit `feat: port backend services to lib/server`.

### Task 3: API routes

**Files:**
- Create: `lib/server/route.js`, `app/api/health/route.js`, `app/api/ai/parse-transaction/route.js`, `app/api/ai/parse-receipt/route.js`

**Interfaces:**
- Consumes: Task 2.
- Produces: `withAuth(handler, { limiter, limitMessage }) → (request) => Response`; handler menerima `(request, { user, supabase })` dan me-return objek JSON.

- [ ] **Step 1:** `withAuth`: Bearer → `createUserClient(token).auth.getUser(token)`; gagal → 401 pesan lama (`Harus login dulu.` / `Sesi tidak valid atau sudah berakhir. Silakan masuk lagi.`). Limiter gagal → 429 dengan pesan lama. `HttpError` → `{ error }` + status; lainnya → log `name + message`, 500 `Terjadi kesalahan di server.`
- [ ] **Step 2:** parse-transaction: JSON body tidak valid → 400 `JSON tidak valid.`; zod gagal → 400 pesan lama.
- [ ] **Step 3:** parse-receipt: `request.formData()`; tanpa `image` → 400; `size > 4 * 1024 * 1024` → 413 `Ukuran gambar maksimal 4 MB.`; `detectImageType` null → 415.
- [ ] **Step 4: Verifikasi** dengan `npm run dev`:
  - `GET /api/health` → 200 `{"status":"ok"}`
  - `POST /api/ai/parse-transaction` tanpa token → 401
  - `POST` dengan `Authorization: Bearer palsu` → 401
  - parse-receipt dengan token asli (diambil lewat login Supabase memakai akun tes bila tersedia) dan file teks bernama `x.jpg` → 415; gambar struk → 200. Kalau token asli tidak tersedia, langkah ini dicatat sebagai belum diverifikasi.
- [ ] **Step 5:** Commit `feat: AI route handlers`.

### Task 4: Lapisan klien (api, context, layout, komponen)

**Files:**
- Create: `lib/api/**` (dari `F/api`), `hooks/**`, `utils/**`, `components/**` (dari `F/components`, tanpa `ProtectedRoute.jsx`), `context/{AuthContext,ThemeContext,FlashContext}.jsx`, `components/layout/NavItem.jsx`, `utils/resizeImage.js`
- Modify: `app/layout.jsx`

**Interfaces:**
- Produces: `useFlash() → { show(message) }`; `FlashProvider` menampilkan toast (markup toast lama dari AppLayout) selama 3000 ms; `NavItem({ href, exact, className: (isActive) => string, children })`; `resizeImage(file, { maxSide = 1600, quality = 0.85 }) → Promise<File>` (JPEG); `AppLayout({ children })`.

- [ ] **Step 1:** Salin; semua file yang memakai hook/state/browser API diberi `'use client'`. `import.meta.env.VITE_USE_MOCK` → `process.env.NEXT_PUBLIC_USE_MOCK`; `supabase.js` hanya membaca `NEXT_PUBLIC_*`. `client.js`: hapus `BASE_URL`, pesan gagal fetch → `Tidak bisa terhubung ke server. Periksa koneksi internet.`
- [ ] **Step 2:** `ThemeContext`: state awal dibaca di `useEffect`, bukan di initializer. `app/layout.jsx`: `<html lang="id" suppressHydrationWarning>`, skrip inline di `<head>` yang memasang class `dark` dari localStorage `THEME_KEY` / `prefers-color-scheme` sebelum render; provider Theme → Auth → Flash; metadata title `Monify`, `themeColor: '#0d9488'`.
- [ ] **Step 3:** `Sidebar`/`BottomNav` memakai `NavItem`; `AppLayout` menerima `children` (ganti `<Outlet/>`), toast flash dipindah ke `FlashProvider`, `Link to` → `href`.
- [ ] **Step 4:** Verifikasi: `npm run build` sukses.
- [ ] **Step 5:** Commit `feat: port client libs, contexts, components`.

### Task 5: Halaman

**Files:**
- Create: `app/login/page.jsx`, `app/register/page.jsx`, `app/(app)/layout.jsx`, `app/(app)/page.jsx`, `app/(app)/{add,receipt,transactions,wallets,reports,settings}/page.jsx`, `utils/safeNext.js`
- Delete: `app/page.jsx` sementara dari Task 1

**Interfaces:**
- Consumes: Task 4.
- Produces: `safeNext(value) → string` (path internal diawali `/` tapi bukan `//`, selain itu `'/'`).

- [ ] **Step 1:** `(app)/layout.jsx` (client): `checking` → Spinner; tanpa user → `router.replace('/login?next=' + encodeURIComponent(pathname))` dan render Spinner; ada user → `<AppLayout>{children}</AppLayout>`.
- [ ] **Step 2:** Halaman = isi `F/pages/*` dengan pergantian routing di tabel spec. Login: `safeNext(searchParams.get('next'))`; login/register yang sudah login → `router.replace`. Halaman yang memakai `useSearchParams` dibungkus `<Suspense>`. Dashboard → `router.push('/add?text=' + encodeURIComponent(text))`; AddTransaction membaca `text`, lalu `router.replace('/add')`. Simpan sukses → `flash.show(msg)` lalu `router.push('/')`. ReceiptUpload: `resizeImage(file)` sebelum `parseReceipt`.
- [ ] **Step 3:** Tes `utils/safeNext.test.js`: `'/transactions'` → sama; `'//evil.com'`, `'https://evil.com'`, `null`, `'abc'` → `'/'`. Jalankan `node --test utils/` → PASS.
- [ ] **Step 4: Verifikasi** `npm run build` sukses tanpa warning prerender. Mode mock (`NEXT_PUBLIC_USE_MOCK=true npm run dev`): setiap route membalas 200; jalur Review Focus 1–3 dicek di browser.
- [ ] **Step 5:** Commit `feat: port pages to App Router`.

### Task 6: README & pembersihan

- [ ] **Step 1:** `README.md`: cara menjalankan (`npm install`, isi `.env.local`, `npm run dev`), perintah tes, catatan deploy Vercel (env sama, LiteParse belum terbukti di Vercel, `RECEIPT_VISION_FALLBACK`).
- [ ] **Step 2:** `npm test` dan `npm run build` sekali lagi → PASS.
- [ ] **Step 3:** Commit `docs: README`.
