# Import Screenshot Bank dari iPhone Shortcut — Design

Tanggal: 2026-11-05

## Tujuan

User bisa mencatat transaksi bank langsung dari iPhone tanpa laptop: buka aplikasi m-banking,
ketuk punggung HP dua kali (Back Tap), dan transaksinya tersimpan di Monify. HP menampilkan
notifikasi hasilnya.

Kriteria berhasil:
- Shortcut iOS mengirim screenshot ke Monify (sudah di-deploy di Vercel) dan transaksi tersimpan
  ke akun pemilik key, memakai logika yang sama dengan `npm run watch` (`importScreenshot`):
  OCR + AI, pencocokan dompet, buang baris tanggal tidak jelas, cegah duplikat.
- Screenshot yang tidak jelas tidak disimpan; Shortcut menerima pesan "Perlu dicek: <alasan>".
- Respons selalu berisi satu kalimat `message` yang siap ditampilkan sebagai notifikasi.
- Autentikasi memakai personal API key per user yang bisa dibuat dan dicabut sendiri dari halaman
  Pengaturan. Password tidak pernah disimpan di Shortcut.
- Tetap tanpa secret / service_role key Supabase. Kepemilikan data dijaga oleh database.

Di luar cakupan versi pertama:
- Trigger otomatis saat screenshot masuk galeri (tidak didukung iOS).
- Hak akses per key (scope). Key hanya bisa dipakai untuk endpoint import ini.
- Masa berlaku key. Key berlaku sampai dihapus.
- Antrean / retry di server. Kalau gagal sementara (AI sibuk), user cukup ketuk lagi.
- Mengirim file `.shortcut` jadi. Yang disediakan adalah panduan langkah demi langkah.

## Pendekatan

RLS Monify bergantung pada `auth.uid()` dari token login Supabase, dan proyek sengaja tidak
memakai secret key. Jadi API key dijembatani lewat fungsi Postgres `SECURITY DEFINER`:
server memanggil fungsi itu dengan publishable key + API key asli; fungsi meng-hash key,
menemukan pemiliknya, dan hanya membaca / menulis data milik user itu.

Alternatif yang ditolak:
- Membuat JWT sendiri dengan JWT secret Supabase: secret itu sekuat service_role key.
- Shortcut login sendiri dengan email + password: password tersimpan di HP dan tidak bisa
  dicabut tanpa mengganti password.

## Database

Migration baru `supabase/migrations/20261105000000_api_keys.sql`, juga ditambahkan ke
`supabase/schema.sql` supaya tetap jadi gambaran lengkap skema.

### Tabel `api_keys`

| kolom | tipe | catatan |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `user_id` | uuid not null | default `auth.uid()`, FK `auth.users` on delete cascade |
| `name` | text not null | 1–40 karakter, misalnya "iPhone" |
| `key_hash` | text not null unique | hex SHA-256 dari key asli |
| `prefix` | text not null | 12 karakter pertama key (`mnf_` + 8), untuk ditampilkan |
| `created_at` | timestamptz | default `now()` |
| `last_used_at` | timestamptz | null sampai pertama dipakai |

RLS: `select`, `insert`, `delete` hanya untuk baris milik sendiri (`user_id = auth.uid()`).
Tidak ada policy `update` untuk user; `last_used_at` hanya diisi oleh fungsi di bawah.
Maksimal 5 key per user (dicek di policy insert lewat fungsi helper).

### Format key

`mnf_` + 32 byte acak dalam base64url (total 47 karakter). Dibuat di browser dengan
`crypto.getRandomValues`, di-hash SHA-256 di browser, lalu hanya `key_hash`, `prefix`, dan
`name` yang dikirim ke database. Key asli ditampilkan **sekali** ke user dan tidak bisa
dilihat lagi. SHA-256 tanpa salt cukup karena key berentropi 256 bit (bukan password).

### Fungsi untuk API key

Semua fungsi: `language plpgsql security definer set search_path = ''`, menerima key asli
(`p_key text`), menghitung `encode(extensions.digest(p_key, 'sha256'), 'hex')` di dalam
Postgres, lalu mencari pemilik key. Key tidak ditemukan → `raise exception` dengan
`errcode = '28000'` (invalid authorization). Hak eksekusi: `revoke ... from public`, lalu
`grant execute ... to anon, authenticated` (server memanggilnya dengan publishable key tanpa
login).

Helper internal `api_key_owner(p_key) returns uuid` (tidak di-grant ke siapa pun) dipakai oleh
ketiga fungsi berikut:

1. `api_key_lists(p_key text) returns jsonb`
   - `{ wallets: [{id, name}], categories: [{id, name, type}] }` milik pemilik key (kategori
     milik user + kategori default `user_id is null`). Bentuknya sama dengan `loadUserLists`.
   - Mengisi `last_used_at = now()`.

2. `api_key_existing(p_key text, p_wallet_id uuid, p_from date, p_to date) returns table (date date, type text, amount bigint)`
   - Transaksi milik pemilik key di dompet itu pada rentang tanggal itu (untuk cegah duplikat).

3. `api_key_insert_transactions(p_key text, p_wallet_id uuid, p_rows jsonb) returns int`
   - Dompet harus milik pemilik key, setiap `category_id` harus milik pemilik atau default dan
     `type`-nya cocok. Kalau ada yang tidak lolos → exception, tidak ada yang tersimpan.
   - Insert semua baris dalam satu statement dengan `user_id` = pemilik key,
     `source = 'ai_receipt'`. Constraint tabel (`amount > 0`, panjang `note`, dll.) tetap berlaku.
   - Maksimal 50 baris per panggilan (sama dengan batas parser).
   - Mengembalikan jumlah baris yang tersimpan.

## Server

### Refactor `importScreenshot`

`importScreenshot({ buffer, supabase, lists, ... })` diganti menjadi
`importScreenshot({ buffer, store, lists, ... })`, dengan `store` berisi:

- `findExisting({ walletId, from, to })` → `[{ date, type, amount }]`
- `insert({ walletId, rows })` → menyimpan baris (tanpa `wallet_id` / `source`; store yang
  menambahkan)

Dua implementasi di `lib/server/importStores.js`:
- `supabaseStore(supabase)`: perilaku sekarang (query `transactions` biasa, RLS). Dipakai
  watcher `scripts/watch-inbox.mjs`.
- `apiKeyStore(supabase, key)`: memanggil `api_key_existing` / `api_key_insert_transactions`.

Error dari store tetap `HttpError(502, ...)` seperti sekarang. Perilaku watcher tidak berubah.

### Endpoint `POST /api/import/bank-screenshot`

- `runtime = 'nodejs'`, `maxDuration = 60`.
- Header `Authorization: Bearer mnf_...`. Tanpa header / bukan format `mnf_` → 401 tanpa
  memanggil database.
- Body multipart, field `image` (maks 4 MB, dicek magic bytes oleh `importScreenshot`).
- Alur: `api_key_lists` (key salah → 401) → rate limit 10/menit per key (pakai `key_hash`
  sebagai kunci, bukan key asli) → `importScreenshot` dengan `apiKeyStore`.
- Client Supabase: publishable key tanpa token user (`createAnonClient` baru di
  `lib/server/supabase.js`).
- Pembungkus baru `withApiKey` di `lib/server/route.js`, mengikuti pola `withAuth`
  (error terpusat, hanya pesan `HttpError` yang sampai ke user).

Respons (selalu JSON dengan `message`):

| kasus | status | contoh `message` |
|---|---|---|
| tersimpan | 200 `{status:'saved', inserted, skipped, dropped, wallet}` | `3 transaksi tersimpan ke BCA (1 duplikat dilewati)` |
| semua duplikat | 200 `status:'saved'`, `inserted: 0` | `Tidak ada transaksi baru di BCA (2 duplikat dilewati)` |
| perlu dicek | 200 `{status:'review', reason}` | `Perlu dicek: Bank "Jago" tidak ada di dompet Monify` |
| tanpa gambar / terlalu besar | 400 / 413 | `Gambar belum dikirim (field "image").` |
| key salah / dicabut | 401 | `API key tidak valid. Buat key baru di Pengaturan Monify.` |
| terlalu sering | 429 | `Terlalu banyak screenshot. Coba lagi sebentar lagi.` |
| AI / Supabase gagal | 5xx | pesan `HttpError` yang sudah ada |

"Perlu dicek" sengaja 200 supaya Shortcut tetap menampilkan `message` (Shortcuts tidak
membaca body dengan mudah saat status error).

## UI

### Pengaturan → "Shortcut iPhone"

Bagian baru di `app/(app)/settings/page.jsx`, komponennya di `components/ApiKeys.jsx`,
akses data di `lib/api/apiKeys.js` (Supabase langsung dari browser, RLS):

- Daftar key: nama, prefix (`mnf_ab12cd34…`), dibuat, terakhir dipakai ("belum pernah").
- **Buat key**: input nama → key dibuat dan ditampilkan sekali dalam kotak dengan tombol
  **Salin** dan peringatan "Simpan sekarang, key tidak bisa dilihat lagi".
- **Hapus**: lewat `ConfirmDialog` yang sudah ada. Shortcut yang memakai key itu langsung
  ditolak.
- Mode mock (`NEXT_PUBLIC_USE_MOCK`): bagian ini menampilkan keterangan bahwa fitur hanya
  tersedia dengan Supabase.

### Panduan Shortcut

Di bawah daftar key, langkah singkat (bisa dibuka-tutup):
1. Shortcuts → buat shortcut baru "Kirim ke Monify".
2. **Take Screenshot**.
3. **Get Contents of URL**: URL `https://<domain>/api/import/bank-screenshot` (domain diisi
   otomatis dari `window.location.origin`), Method POST, Header
   `Authorization: Bearer <key>`, Request Body **Form**, field `image` = Screenshot.
4. **Get Dictionary Value** `message` → **Show Notification**.
5. Settings → Accessibility → Touch → Back Tap → Double Tap → "Kirim ke Monify".

## Penanganan error

- Key salah, dicabut, atau user dihapus → 401; key tidak pernah dicatat di log.
- Exception dari fungsi SQL (dompet / kategori bukan milik pemilik key) → 502
  "Gagal menyimpan transaksi." Ini seharusnya tidak terjadi karena `lists` berasal dari user
  yang sama; pemeriksaan di SQL adalah lapisan pengaman.
- Log server hanya mencatat nama error, tanpa isi OCR, nominal, atau key (sama dengan aturan
  yang sudah ada).

## Susunan file

- `supabase/migrations/20261105000000_api_keys.sql` (baru), `supabase/schema.sql` (ditambah)
- `lib/server/importStores.js` (baru) + test
- `lib/server/bankImport.js` (pakai `store`), `lib/server/bankImport.test.js` (disesuaikan)
- `lib/server/supabase.js` (`createAnonClient`)
- `lib/server/route.js` (`withApiKey`) + test
- `lib/server/rateLimit.js` (`importLimiter`)
- `app/api/import/bank-screenshot/route.js` (baru)
- `scripts/watch-inbox.mjs` (pakai `supabaseStore`)
- `lib/api/apiKeys.js`, `components/ApiKeys.jsx` (baru), `app/(app)/settings/page.jsx`

## Pengujian

- Unit (`node --test`):
  - `importScreenshot` dengan store palsu: saved, review, semua duplikat, error store dilempar.
  - `importStores`: memanggil RPC / query yang benar dengan argumen yang benar.
  - `withApiKey`: tanpa header → 401, bukan `mnf_` → 401, RPC menolak key → 401,
    rate limit → 429, `HttpError` diteruskan, error lain → 500.
  - Pembuat pesan notifikasi: saved / semua duplikat / review.
- Manual di Supabase (SQL editor) setelah migration: key valid mengembalikan lists; key salah
  ditolak; insert ke dompet user lain ditolak; kategori user lain ditolak; user lain tidak bisa
  melihat baris `api_keys` orang lain.
- Manual end-to-end: buat key di Pengaturan, panggil endpoint dari Postman, lalu dari Shortcut
  iPhone ke deployment Vercel.
