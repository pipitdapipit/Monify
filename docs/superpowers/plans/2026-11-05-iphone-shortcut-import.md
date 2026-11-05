# Import Screenshot Bank dari iPhone Shortcut — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iPhone Shortcut mengirim screenshot bank ke `POST /api/import/bank-screenshot` dengan personal API key, dan transaksinya tersimpan lewat `importScreenshot` yang sudah ada.

**Architecture:** API key (hash SHA-256) disimpan di tabel `api_keys`. Server memanggil fungsi Postgres `SECURITY DEFINER` dengan publishable key + key asli; fungsi meng-hash key dan hanya menyentuh data pemiliknya. `importScreenshot` disimpan/dibaca lewat objek `store` supaya watcher (RLS biasa) dan endpoint (fungsi API key) memakai alur yang sama.

**Tech Stack:** Next.js 16 route handler (Node runtime), supabase-js, Postgres/plpgsql + pgcrypto, React (client component), `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-05-iphone-shortcut-import-design.md`

## Global Constraints

- Tidak memakai secret / service_role key Supabase di mana pun.
- Format key: `mnf_` + 32 byte acak base64url (47 karakter). `prefix` = 12 karakter pertama. Hash = hex SHA-256 dari key utuh.
- Maksimal 5 key per user; `name` 1–40 karakter.
- Fungsi SQL: `security definer`, `set search_path = ''`, key salah → `raise exception ... using errcode = '28000'`.
- Maksimal 50 baris per insert; `source = 'ai_receipt'`.
- Rate limit endpoint: 10 request / 60 detik per key (kunci limiter = hash, bukan key asli).
- Gambar maksimal 4 MB (sudah dicek di `importScreenshot`).
- Setiap respons endpoint (termasuk error) berisi field `message` berbahasa Indonesia.
- Key, teks OCR, nominal, dan keterangan transaksi tidak pernah dicetak ke log.
- Sebelum menulis route handler, baca panduan route handler di `node_modules/next/dist/docs/` (AGENTS.md).
- Test dijalankan dengan `npm test` (`node --conditions=react-server --test`); file test `*.test.js` di samping kodenya.

## Review Focus

1. Header dari Shortcut ditulis `bearer mnf_...` (huruf kecil) atau key ter-paste dengan spasi/newline di ujung → tetap diterima. Test di Task 3.
2. Respons error (401/429/500) harus tetap punya `message`, karena Shortcut hanya menampilkan `message`. Test di Task 3.
3. Screenshot iPhone Pro Max bisa > 4,5 MB (batas body Vercel, dibalas Vercel di luar kode kita) → panduan Shortcut wajib memuat langkah **Convert Image → JPEG**. Diperiksa di Task 5.
4. Key yang sudah dihapus dipakai lagi → 401 dengan pesan "API key tidak valid…", bukan 500. Test di Task 3 (RPC error code `28000`).
5. Insert lewat API key ke dompet / kategori milik user lain → ditolak dan tidak ada baris tersimpan. Dicek manual dengan SQL di Task 1.

---

### Task 1: Tabel `api_keys` dan fungsi SQL

**Files:**
- Create: `supabase/migrations/20261105000000_api_keys.sql`
- Modify: `supabase/schema.sql` (tambahkan isi migration yang sama: tabel di bagian Tables, policy di bagian RLS, fungsi + grant di bagian akhir)

**Interfaces:**
- Produces (dipanggil lewat `supabase.rpc`, semua menerima key asli):
  - `api_key_lists(p_key text) returns jsonb` → `{ "wallets": [{id, name}], "categories": [{id, name, type}] }`; mengisi `last_used_at`.
  - `api_key_existing(p_key text, p_wallet_id uuid, p_from date, p_to date) returns table (date date, type text, amount bigint)`
  - `api_key_insert_transactions(p_key text, p_wallet_id uuid, p_rows jsonb) returns int`; `p_rows` = array `{date, type, amount, note, category_id}`.
  - Tabel `public.api_keys (id, user_id, name, key_hash, prefix, created_at, last_used_at)`.

- [ ] **Step 1: Tulis migration**

Isi:
- `create extension if not exists pgcrypto with schema extensions;`
- Tabel `api_keys` sesuai spec (`name` check `char_length between 1 and 40`, `key_hash` unique, `prefix` check `char_length = 12`), index `api_keys_user_idx (user_id)`.
- RLS aktif. Policy `select` / `delete`: `user_id = (select auth.uid())`. Policy `insert`: `user_id = (select auth.uid()) and public.api_key_count_ok()`. Tanpa policy `update`.
- `api_key_count_ok() returns boolean` (security invoker, stable): jumlah key milik `auth.uid()` `< 5`. Grant ke `authenticated` saja.
- `api_key_owner(p_key text) returns uuid` (security definer): `select user_id from public.api_keys where key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex')`; null → raise `'invalid api key'` errcode `28000`. `revoke all ... from public, anon, authenticated`.
- Tiga fungsi di Interfaces, masing-masing memanggil `api_key_owner` lebih dulu. `api_key_insert_transactions`:
  - `jsonb_array_length(p_rows)` antara 1 dan 50, kalau tidak → raise errcode `22023`.
  - Dompet bukan milik owner → raise errcode `42501`.
  - Ada baris dengan `category_id` yang bukan milik owner / default atau `type` tidak cocok → raise errcode `42501`.
  - `insert into public.transactions (user_id, wallet_id, category_id, type, amount, date, note, source) select ... from jsonb_to_recordset(p_rows) as r(date date, type text, amount bigint, note text, category_id uuid)` dengan `source = 'ai_receipt'`; return `row_count`.
- `revoke execute on function <ketiganya> from public;` `grant execute ... to anon, authenticated;`

- [ ] **Step 2: Terapkan migration ke Supabase**

Minta user menjalankan isi file di Supabase SQL Editor (atau, dengan izin user, lewat Supabase MCP `apply_migration`). Expected: sukses tanpa error; tabel `api_keys` muncul.

- [ ] **Step 3: Verifikasi manual di SQL Editor**

Sebagai user A (insert langsung baris `api_keys` dengan `key_hash = encode(extensions.digest('mnf_testA', 'sha256'), 'hex')`, `prefix = 'mnf_testA000'`), lalu:
- `select public.api_key_lists('mnf_testA');` → wallets/categories milik A.
- `select public.api_key_lists('mnf_salah');` → ERROR `invalid api key`.
- `select public.api_key_insert_transactions('mnf_testA', '<wallet milik user B>', '[...]');` → ERROR, tidak ada baris baru.
- Kategori milik user B dengan dompet A → ERROR.
- `set role anon; select * from public.api_keys;` → 0 baris. `reset role;`
- Hapus baris test setelahnya.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261105000000_api_keys.sql supabase/schema.sql
git commit -m "feat: api_keys table and key-scoped import functions"
```

---

### Task 2: `store` untuk `importScreenshot`

**Files:**
- Create: `lib/server/importStores.js`, `lib/server/importStores.test.js`
- Modify: `lib/server/bankImport.js:96-166`, `lib/server/bankImport.test.js:130-170` (dan test yang memakai `fakeSupabase`), `scripts/watch-inbox.mjs:66`

**Interfaces:**
- Produces:
  - `importScreenshot({ buffer, store, lists, today?, deps? })` — parameter `supabase` diganti `store`; hasil tidak berubah.
  - `store.findExisting({ walletId, from, to }) → Promise<Array<{date, type, amount}>>`
  - `store.insert({ walletId, rows }) → Promise<void>`; `rows` = `[{date, type, amount, note, category_id}]` (tanpa `wallet_id`/`source`).
  - `supabaseStore(supabase)` dan `apiKeyStore(supabase, key)` dari `lib/server/importStores.js`. Keduanya melempar `HttpError(502, 'Gagal mengambil transaksi yang sudah ada.')` / `HttpError(502, 'Gagal menyimpan transaksi.')` saat Supabase mengembalikan error.

- [ ] **Step 1: Tulis test `importStores.test.js` yang gagal**

- `supabaseStore findExisting memfilter dompet dan rentang tanggal`: fake client merekam `from('transactions')`, `.select('date, type, amount')`, `.eq('wallet_id', 'w1')`, `.gte('date', '2026-11-01')`, `.lte('date', '2026-11-03')`; hasil = `data`.
- `supabaseStore insert menambah wallet_id dan source`: insert dipanggil sekali dengan `[{...row, wallet_id: 'w1', source: 'ai_receipt'}]`.
- `apiKeyStore findExisting memanggil api_key_existing`: `rpc('api_key_existing', { p_key: 'mnf_x', p_wallet_id: 'w1', p_from: '2026-11-01', p_to: '2026-11-03' })`.
- `apiKeyStore insert memanggil api_key_insert_transactions`: `rpc('api_key_insert_transactions', { p_key: 'mnf_x', p_wallet_id: 'w1', p_rows: rows })`.
- `error Supabase jadi HttpError 502` untuk keempat jalur (status 502, pesan sesuai Interfaces).

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npm test -- lib/server/importStores.test.js` → FAIL (modul tidak ada).

- [ ] **Step 3: Implementasi `lib/server/importStores.js`** (`import 'server-only'`, pakai `HttpError`).

- [ ] **Step 4: Ubah `importScreenshot` memakai `store`**

Ganti query `transactions` dan insert dengan `store.findExisting({ walletId: wallet.id, from: dates[0], to: dates.at(-1) })` dan `store.insert({ walletId: wallet.id, rows: toInsert })` (hanya kalau `toInsert.length > 0`). Perbarui komentar di atas fungsi.

- [ ] **Step 5: Sesuaikan `bankImport.test.js`**

Ganti `fakeSupabase(existing, insertError)` dengan `fakeStore(existing, insertError)` yang mengembalikan `{ calls: { inserts: [] }, findExisting: async () => existing, insert: async ({ walletId, rows }) => { calls.inserts.push({ walletId, rows }); if (insertError) throw insertError } }`. Test "baris baru disimpan dalam satu insert" sekarang mengecek `calls.inserts[0].walletId` dan `rows` tanpa `source`. Test "insert gagal" melempar `HttpError(502, 'Gagal menyimpan transaksi.')` dari store dan mengecek error yang sama keluar dari `importScreenshot`.

- [ ] **Step 6: Watcher memakai `supabaseStore`**

`scripts/watch-inbox.mjs`: `const store = supabaseStore(supabase)` setelah login; `importFile: (buffer, lists) => importScreenshot({ buffer, store, lists })`.

- [ ] **Step 7: Jalankan semua test**

Run: `npm test` → semua PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/server/importStores.js lib/server/importStores.test.js lib/server/bankImport.js lib/server/bankImport.test.js scripts/watch-inbox.mjs
git commit -m "refactor: importScreenshot saves through a store"
```

---

### Task 3: `withApiKey`, client anon, dan limiter

**Files:**
- Modify: `lib/server/supabase.js`, `lib/server/route.js`, `lib/server/route.test.js`, `lib/server/rateLimit.js`

**Interfaces:**
- Consumes: RPC `api_key_lists` (Task 1).
- Produces:
  - `createAnonClient()` di `lib/server/supabase.js`: publishable key, tanpa header Authorization, opsi auth/realtime sama dengan `createUserClient`.
  - `importLimiter = createLimiter({ limit: 10, windowMs: 60_000 })` di `rateLimit.js`.
  - `withApiKey(handler, { limiter, limitMessage, createClient = createAnonClient })` di `route.js`. `handler(request, { key, supabase, lists })` me-return objek yang dikirim sebagai JSON 200.

Aturan `withApiKey`:
- Header di-`trim()`; skema dicek tanpa beda huruf besar/kecil (`bearer` = `Bearer`); key di-`trim()`.
- Key tidak diawali `mnf_` → 401 tanpa memanggil `createClient`.
- `supabase.rpc('api_key_lists', { p_key: key })`: error `code === '28000'` → 401; error lain → 502 `Gagal mengambil data dompet / kategori.`
- Limiter dipanggil dengan hex SHA-256 key (`node:crypto` `createHash`) setelah key valid; ditolak → 429 dengan `limitMessage`.
- Semua respons error berbentuk `{ error: msg, message: msg }`. Pesan 401: `API key tidak valid. Buat key baru di Pengaturan Monify.`
- `HttpError` dari handler → status + pesannya; error lain → 500 `Terjadi kesalahan di server.` (log hanya `err.name`).

- [ ] **Step 1: Tulis test yang gagal di `route.test.js`**

Pakai fake `createClient` yang mengembalikan `{ rpc: async (name, args) => ... }` dan merekam panggilan.
- `withApiKey: tanpa header -> 401 dengan message, createClient tidak dipanggil`
- `withApiKey: key tanpa awalan mnf_ -> 401`
- `withApiKey: "bearer" huruf kecil dan spasi/newline di ujung tetap diterima` (header `'bearer mnf_abc \n'`, rpc menerima `p_key: 'mnf_abc'`, status 200)
- `withApiKey: rpc 28000 -> 401 dengan pesan API key tidak valid`
- `withApiKey: rpc error lain -> 502`
- `withApiKey: limiter menerima hash, bukan key asli; ditolak -> 429 dengan message` (limiter palsu merekam argumen; argumen = sha256 hex dari `mnf_abc`, bukan `mnf_abc`)
- `withApiKey: handler menerima lists dan key, hasil dikirim 200`
- `withApiKey: HttpError dari handler diteruskan; error lain -> 500` (keduanya punya `message`)

- [ ] **Step 2: Jalankan, pastikan gagal** — `npm test -- lib/server/route.test.js` → FAIL (`withApiKey` tidak ada).

- [ ] **Step 3: Implementasi** `createAnonClient`, `importLimiter`, `withApiKey`.

- [ ] **Step 4: Jalankan semua test** — `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/server/supabase.js lib/server/route.js lib/server/route.test.js lib/server/rateLimit.js
git commit -m "feat: withApiKey route wrapper for personal API keys"
```

---

### Task 4: Endpoint `POST /api/import/bank-screenshot`

**Files:**
- Create: `lib/server/importMessage.js`, `lib/server/importMessage.test.js`, `app/api/import/bank-screenshot/route.js`

**Interfaces:**
- Consumes: `withApiKey`, `importLimiter` (Task 3); `importScreenshot`, `apiKeyStore` (Task 2).
- Produces: `importMessage(result) → string` dan endpoint yang membalas `{ ...result, message }`.

- [ ] **Step 1: Tulis test `importMessage.test.js` yang gagal**

- `saved dengan duplikat`: `{status:'saved', wallet:'BCA', inserted:3, skipped:1, dropped:0}` → `3 transaksi tersimpan ke BCA (1 duplikat dilewati)`
- `saved tanpa duplikat`: `inserted:1, skipped:0` → `1 transaksi tersimpan ke BCA`
- `semua duplikat`: `inserted:0, skipped:2` → `Tidak ada transaksi baru di BCA (2 duplikat dilewati)`
- `baris dibuang disebut`: `inserted:2, skipped:0, dropped:1` → `2 transaksi tersimpan ke BCA (1 baris dilewati karena tidak jelas)`; kalau ada duplikat dan dibuang sekaligus, keduanya dalam satu kurung dipisah `, `.
- `review`: `{status:'review', reason:'Bank "Jago" tidak ada di dompet Monify'}` → `Perlu dicek: Bank "Jago" tidak ada di dompet Monify`

- [ ] **Step 2: Jalankan, pastikan gagal**, lalu **Step 3: implementasi** `importMessage`, lalu **Step 4: `npm test` → PASS**.

- [ ] **Step 5: Tulis route handler**

`app/api/import/bank-screenshot/route.js`: `runtime = 'nodejs'`, `maxDuration = 60`. `POST = withApiKey(async (request, { key, supabase, lists }) => { ... }, { limiter: importLimiter, limitMessage: 'Terlalu banyak screenshot. Coba lagi sebentar lagi.' })`. Ambil field `image` persis seperti `app/api/ai/parse-receipt/route.js` (pesan 400 / 413 yang sama), lalu `importScreenshot({ buffer, store: apiKeyStore(supabase, key), lists })` dan return `{ ...result, message: importMessage(result) }`.

- [ ] **Step 6: Uji manual lokal**

Buat key test lewat SQL (seperti Task 1 Step 3) atau tunggu Task 5. `npm run dev`, lalu di Postman: POST `http://localhost:3000/api/import/bank-screenshot`, Bearer `<key>`, form-data `image` = screenshot BCA. Expected: 200 dengan `message` "… transaksi tersimpan ke …". Tanpa key → 401 dengan `message`. Kirim ulang file yang sama → "Tidak ada transaksi baru …".

- [ ] **Step 7: Commit**

```bash
git add lib/server/importMessage.js lib/server/importMessage.test.js app/api/import/bank-screenshot/route.js
git commit -m "feat: POST /api/import/bank-screenshot for iPhone Shortcut"
```

---

### Task 5: Kelola key dan panduan Shortcut di Pengaturan

**Files:**
- Create: `utils/apiKey.js`, `utils/apiKey.test.js`, `lib/api/apiKeys.js`, `components/ApiKeys.jsx`
- Modify: `lib/api/supabaseHandlers.js` (tambah tiga handler), `app/(app)/settings/page.jsx` (sisipkan `<ApiKeys />` sebelum tombol Keluar)

**Interfaces:**
- Consumes: tabel `api_keys` (Task 1), endpoint (Task 4).
- Produces:
  - `generateApiKey() → Promise<{ key, prefix, hash }>` di `utils/apiKey.js` (Web Crypto: `crypto.getRandomValues` + `crypto.subtle.digest('SHA-256')`, base64url tanpa padding).
  - `lib/api/apiKeys.js`: `getApiKeys() → [{id, name, prefix, created_at, last_used_at}]` (urut `created_at` desc), `createApiKey(name) → { key, item }` (generate di browser, insert `{name, prefix, key_hash}`; `key` asli hanya dikembalikan di sini), `deleteApiKey(id)`. Di mode mock ketiganya melempar `ApiError('Fitur ini hanya tersedia dengan Supabase.', 0)`.

- [ ] **Step 1: Tulis test `utils/apiKey.test.js` yang gagal**

- `key berawalan mnf_ dan panjang 47, hanya karakter base64url` (`/^mnf_[A-Za-z0-9_-]{43}$/`)
- `prefix = 12 karakter pertama key`
- `hash = sha256 hex dari key` (bandingkan dengan `createHash('sha256').update(key).digest('hex')` dari `node:crypto`)
- `dua panggilan menghasilkan key berbeda`

- [ ] **Step 2: Jalankan, gagal; Step 3: implementasi; Step 4: `npm test` → PASS**

- [ ] **Step 5: Handler Supabase + `lib/api/apiKeys.js`**

Ikuti pola `lib/api/wallets.js` / `supabaseHandlers.js` (`db()`, `check(error)`). Tambahkan ke `byCode` di `check`: kalau insert ditolak policy (`42501`) pada `api_keys`, pesannya `Maksimal 5 key. Hapus key lama dulu.` — lakukan dengan menangkap `42501` di `createApiKey` sebelum memanggil `check`.

- [ ] **Step 6: Komponen `components/ApiKeys.jsx`** (`'use client'`)

Satu `<section className="rounded-2xl bg-white p-4 shadow-sm">` berjudul "Shortcut iPhone", memakai `useApi`, `Button`, `Field`/`fieldClass`, `Skeleton`, `ErrorState`, `ConfirmDialog` yang sudah ada:
- Daftar key: nama, `prefix…`, "Dibuat <tanggal>", "Terakhir dipakai <tanggal>" / "Belum pernah dipakai", tombol Hapus → `ConfirmDialog` (judul `Hapus key "<nama>"?`, pesan `Shortcut yang memakai key ini akan langsung ditolak.`).
- Form: input nama (default `iPhone`, maks 40) + tombol **Buat key**. Setelah dibuat: kotak berisi key + tombol **Salin** (`navigator.clipboard.writeText`) + teks `Simpan sekarang. Key ini tidak bisa dilihat lagi.`; kotak hilang saat ditutup.
- Mode mock: hanya teks `Fitur ini hanya tersedia dengan Supabase.`
- `<details>` "Cara pasang di iPhone" berisi langkah:
  1. Buka app **Shortcuts**, buat shortcut baru bernama "Kirim ke Monify".
  2. Tambah **Take Screenshot**.
  3. Tambah **Convert Image** → format **JPEG** (supaya ukuran tetap kecil).
  4. Tambah **Get Contents of URL**: URL `{window.location.origin}/api/import/bank-screenshot`, Method **POST**, Headers `Authorization` = `Bearer <key kamu>`, Request Body **Form**, field **File** bernama `image` = hasil Convert Image.
  5. Tambah **Get Dictionary Value** untuk key `message`, lalu **Show Notification** dengan nilainya.
  6. Buka **Settings → Accessibility → Touch → Back Tap → Double Tap**, pilih "Kirim ke Monify".

URL ditampilkan lengkap dengan tombol Salin; `window.location.origin` dibaca di `useEffect` (komponen juga dirender saat prerender).

- [ ] **Step 7: Sisipkan di halaman Pengaturan** — `import ApiKeys from '@/components/ApiKeys'` dan `<ApiKeys />` sebelum tombol Keluar.

- [ ] **Step 8: Uji manual di browser**

`npm run dev`, buka `/settings`: buat key → key tampil sekali dan bisa disalin; daftar menampilkan prefix dan "Belum pernah dipakai"; panggil endpoint dari Postman dengan key itu → "Terakhir dipakai" terisi setelah refresh; buat key ke-6 → pesan maksimal 5; hapus key → Postman dengan key itu dibalas 401. `npm test` dan `npm run build` → sukses.

- [ ] **Step 9: Commit**

```bash
git add utils/apiKey.js utils/apiKey.test.js lib/api/apiKeys.js lib/api/supabaseHandlers.js components/ApiKeys.jsx "app/(app)/settings/page.jsx"
git commit -m "feat: manage iPhone Shortcut API keys in settings"
```

---

### Task 6: Uji end-to-end di Vercel dan iPhone

- [ ] **Step 1:** Pastikan migration (Task 1) sudah diterapkan di project Supabase yang dipakai deployment Vercel.
- [ ] **Step 2:** Deploy branch (preview Vercel) — dikerjakan user, atau dengan izin user.
- [ ] **Step 3:** Di web hasil deploy: buat key di Pengaturan, pasang Shortcut sesuai panduan, buka m-banking, ketuk punggung HP dua kali. Expected: notifikasi "… transaksi tersimpan ke …", transaksi muncul di Monify. Ulangi pada layar yang sama → "Tidak ada transaksi baru …". Screenshot non-bank → "Perlu dicek: …".
