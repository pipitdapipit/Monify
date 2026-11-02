# Folder Inbox Screenshot Bank Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skrip `npm run watch` yang memantau folder di laptop dan menyimpan transaksi dari screenshot bank / e-wallet ke Monify secara otomatis.

**Architecture:** Logika murni dan alur parse-simpan ada di `lib/server/bankImport.js` (tanpa filesystem, dependency OCR/AI bisa disuntik untuk test). Prompt AI baru ada di `lib/server/ai.js`. Skrip `scripts/watch-inbox.mjs` hanya mengurus login, polling folder, dan memindah file; helper file-nya di `scripts/inboxFiles.mjs` supaya bisa dites.

**Tech Stack:** Node ≥ 20.9 (ESM), `node:test`, `zod`, `@supabase/supabase-js`, `@llamaindex/liteparse` (via `ocrImage`), `ws`. Tidak ada dependency baru.

**Spec:** `docs/superpowers/specs/2026-11-02-bank-screenshot-inbox-design.md`

## Global Constraints

- JavaScript, bukan TypeScript. Komentar dan pesan untuk user berbahasa Indonesia, mengikuti gaya file di `lib/server/`.
- Tidak ada dependency baru. Tidak ada perubahan skema database maupun web app.
- File di `lib/server/` diawali `import 'server-only'`; skrip dan test dijalankan dengan `--conditions=react-server`.
- `source` transaksi = `'ai_receipt'`.
- Batas: ukuran file 4 MB (`4 * 1024 * 1024`), teks OCR minimal 20 karakter, `confidence` < 0.5 → perlu dicek, `note` maksimal 60 karakter, maksimal 50 baris per screenshot, gagal sementara maksimal 3 kali, polling setiap 5 detik.
- Ekstensi yang diproses: `.jpg`, `.jpeg`, `.png`, `.webp` (tidak peka huruf besar/kecil).
- Folder default `%USERPROFILE%\Pictures\Monify Inbox` (`path.join(os.homedir(), 'Pictures', 'Monify Inbox')`), subfolder `selesai` dan `perlu-dicek`.
- Env baru: `MONIFY_INBOX` (opsional), `MONIFY_EMAIL`, `MONIFY_PASSWORD`.
- Teks OCR, nominal, dan keterangan transaksi tidak pernah dicetak ke log.
- File tidak pernah dihapus atau ditimpa.
- Kerjakan di branch `feat/bank-inbox`, bukan `main`.

## Review Focus

- AI mengirim `amount` sebagai string (`"25.000"`) atau pecahan → baris itu dibuang dan dihitung di `dropped`, file tidak crash. Test di Task 1.
- Nama kategori ditulis berbeda huruf (`"lainnya"`, `"LAINNYA"`) → tetap dikenali sebagai kategori cadangan. Test di Task 1.
- Mutasi panjang (lebih dari 50 baris) → hanya 50 baris pertama yang diproses, tidak gagal. Test di Task 1.
- Nama file bentrok di folder tujuan, termasuk file `.txt` alasannya → keduanya memakai nama akhir yang sama (`bca (2).png` + `bca (2).txt`), tidak ada yang tertimpa. Test di Task 4.
- File dihapus / dipindah user saat sedang diproses → skrip mencatat log dan lanjut ke file berikutnya, tidak berhenti. Test di Task 4.

---

### Task 1: Pembersihan output AI dan pencocokan dompet

**Files:**
- Modify: `lib/server/schemas.js` (tambah di akhir)
- Create: `lib/server/bankImport.js`
- Test: `lib/server/bankImport.test.js`

**Interfaces:**
- Produces:
  - `schemas.js`: `llmBankScreenshotSchema` (`{ bank: string|null (trim, max 60, catch null), transactions: unknown[] (catch []), confidence: number (catch 0.3) }`) dan `llmBankRowSchema` (`{ date: string|null (catch null), amount: int > 0 ≤ MAX_RUPIAH, type: 'income'|'expense', description: string (trim, catch ''), category_id: string|null (catch null) }`).
  - `normalizeBankName(name: string|null) => string` — huruf kecil, hanya `[a-z0-9]`.
  - `matchWallet(bank: string|null, wallets: {id,name}[]) => { wallet: {id,name} } | { reason: string }`
  - `cleanBankScreenshot(raw: unknown, { today: string, categories: {id,name,type}[] }) => { bank: string|null, rows: Row[], dropped: number, confidence: number } | { reason: string }`
  - `Row = { date: string, amount: number, type: 'income'|'expense', note: string, category_id: string }`

- [ ] **Step 1: Buat branch**

Run: `git switch -c feat/bank-inbox`
Expected: `Switched to a new branch 'feat/bank-inbox'`

- [ ] **Step 2: Tulis test yang gagal**

`lib/server/bankImport.test.js`, gaya sama dengan `receipt.test.js`:

```js
const today = '2026-11-02'
const categories = [
  { id: 'c-makan', name: 'Makanan', type: 'expense' },
  { id: 'c-lain-out', name: 'Lainnya', type: 'expense' },
  { id: 'c-gaji', name: 'Gaji', type: 'income' },
  { id: 'c-lain-in', name: 'lainnya', type: 'income' }, // beda huruf, tetap dikenali
]
const wallets = [{ id: 'w-bca', name: 'BCA' }, { id: 'w-sea', name: 'SeaBank' }]
const row = (over) => ({ date: '2026-11-01', amount: 25000, type: 'expense', description: 'Kopi', category_id: 'c-makan', ...over })
```

Test (nama → assertion):
- `'nama bank dinormalisasi'` → `normalizeBankName('Sea Bank') === 'seabank'`, `normalizeBankName(' B.C.A ') === 'bca'`, `normalizeBankName(null) === ''`.
- `'dompet cocok walau beda spasi dan huruf'` → `matchWallet('sea bank', wallets).wallet.id === 'w-sea'`.
- `'bank tidak dikenali -> reason menyebut nama bank'` → `matchWallet('Jago', wallets).reason` mengandung `'Jago'`.
- `'bank kosong -> reason'` → `matchWallet(null, wallets)` punya `reason`.
- `'lebih dari satu dompet cocok -> reason'` → `matchWallet('BCA', [...wallets, { id: 'w2', name: 'B C A' }])` punya `reason`.
- `'baris dengan nominal tidak valid dibuang dan dihitung'` → transaksi `[row(), row({ amount: '25.000' }), row({ amount: 0 }), row({ amount: 1.5 }), row({ type: 'transfer' })]` → `rows.length === 1`, `dropped === 4`.
- `'tanggal masa depan jadi hari ini'` → `row({ date: '2026-12-01' })` → `rows[0].date === today`.
- `'keterangan dipotong 60 karakter'` → `row({ description: 'x'.repeat(80) })` → `rows[0].note.length === 60`.
- `'kategori asing atau beda jenis jadi Lainnya sesuai jenis'` → `row({ category_id: 'asing' })` → `'c-lain-out'`; `row({ type: 'income', category_id: 'c-makan' })` → `'c-lain-in'`; `row({ type: 'income', category_id: 'c-gaji' })` → `'c-gaji'`.
- `'tanpa kategori Lainnya untuk jenis itu -> reason'` → categories tanpa `'c-lain-in'`, baris income tanpa kategori valid → hasil punya `reason`.
- `'maksimal 50 baris'` → 60 baris valid → `rows.length === 50`.
- `'output bukan objek -> rows kosong'` → `cleanBankScreenshot('rusak', ...)` → `rows.length === 0` (bukan crash).

- [ ] **Step 3: Jalankan, pastikan gagal**

Run: `npm test -- lib/server/bankImport.test.js`
Expected: FAIL, `Cannot find module './bankImport.js'`

- [ ] **Step 4: Tambah skema di `schemas.js`, lalu implementasi tiga fungsi di `bankImport.js`**

`cleanBankScreenshot`: parse dengan `llmBankScreenshotSchema.safeParse`; kalau gagal anggap `{ bank: null, transactions: [], confidence: 0 }`. Ambil `transactions.slice(0, 50)`, parse tiap baris dengan `llmBankRowSchema.safeParse`, gagal → `dropped++`. Tanggal lewat `validDateOrToday` dari `receipt.js`. Kategori dipakai kalau ada di `categories` dengan `type` sama; selain itu cari kategori yang `name.trim().toLowerCase() === 'lainnya'` dengan `type` sama; tidak ada → `{ reason: 'Kategori "Lainnya" untuk pemasukan/pengeluaran tidak ada di akun Monify' }`.

Pesan `reason` (dipakai apa adanya di file `.txt`):
- bank kosong: `Nama bank tidak terbaca di screenshot`
- tidak cocok: `Bank "${bank}" tidak ada di dompet Monify`
- cocok ganda: `Bank "${bank}" cocok dengan lebih dari satu dompet`

- [ ] **Step 5: Jalankan test, pastikan lulus**

Run: `npm test -- lib/server/bankImport.test.js`
Expected: semua PASS

- [ ] **Step 6: Commit**

```bash
git add lib/server/schemas.js lib/server/bankImport.js lib/server/bankImport.test.js
git commit -m "feat: clean bank screenshot output and match wallets"
```

---

### Task 2: Perhitungan duplikat

**Files:**
- Modify: `lib/server/bankImport.js`
- Test: `lib/server/bankImport.test.js`

**Interfaces:**
- Consumes: `Row` dari Task 1.
- Produces: `planInserts(rows: Row[], existing: {date,type,amount}[]) => { toInsert: Row[], skipped: number }`. Kunci = `date|type|amount` (dompet sudah disaring oleh query di Task 3). `amount` dari Supabase (`bigint`) bisa datang sebagai string → bandingkan sebagai `Number`.

- [ ] **Step 1: Tulis test yang gagal**

Dengan `kopi = { date: '2026-11-03', type: 'expense', amount: 25000, note: 'Kopi', category_id: 'c' }`:
- `'screenshot pertama: semua disimpan'` → `planInserts([kopi, kopi], [])` → `toInsert.length === 2`, `skipped === 0`.
- `'screenshot sama masuk lagi: tidak ada yang disimpan'` → `planInserts([kopi, kopi], [kopi, kopi])` → `0` dan `skipped === 2`.
- `'tumpang-tindih: hanya selisih'` → `planInserts([kopi], [kopi, kopi])` → `0`, `skipped === 1`.
- `'jenis atau tanggal berbeda bukan duplikat'` → `planInserts([{ ...kopi, type: 'income' }, { ...kopi, date: '2026-11-04' }], [kopi])` → `toInsert.length === 2`.
- `'amount string dari database tetap cocok'` → `planInserts([kopi], [{ ...kopi, amount: '25000' }])` → `0`.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npm test -- lib/server/bankImport.test.js`
Expected: FAIL, `planInserts is not a function`

- [ ] **Step 3: Implementasi `planInserts`**

Hitung jumlah kunci di `existing` dalam `Map`; untuk tiap baris, kalau sisa hitungan > 0 kurangi dan `skipped++`, kalau tidak masukkan ke `toInsert`. Urutan baris dipertahankan.

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npm test -- lib/server/bankImport.test.js`
Expected: semua PASS

- [ ] **Step 5: Commit**

```bash
git add lib/server/bankImport.js lib/server/bankImport.test.js
git commit -m "feat: count-based duplicate check for bank screenshots"
```

---

### Task 3: Prompt AI dan alur import satu screenshot

**Files:**
- Modify: `lib/server/ai.js` (tambah bagian baru setelah bagian "Kalimat bebas")
- Modify: `lib/server/bankImport.js`
- Test: `lib/server/bankImport.test.js`

**Interfaces:**
- Consumes: `cleanBankScreenshot`, `matchWallet`, `planInserts` (Task 1–2); `ocrImage(buffer, ext)` dari `ocr.js`; `detectImageType(buffer)` dari `fileType.js`; `todayJakarta()`; `HttpError`.
- Produces:
  - `ai.js`: `parseBankScreenshotText({ text, today, categories }) => Promise<object>` dan `parseBankScreenshotImage({ image: { buffer, mime }, today, categories }) => Promise<object>`, keduanya lewat `generateJson`, `maxTokens: 1500`.
  - `bankImport.js`: `importScreenshot({ buffer, supabase, lists, today?, deps? }) => Promise<Result>`
    - `lists = { wallets, categories }` (dari `loadUserLists`)
    - `deps = { ocr, parseText, parseImage }`, default `ocrImage`, `parseBankScreenshotText`, `parseBankScreenshotImage`
    - `Result = { status: 'saved', wallet: string, inserted: number, skipped: number, dropped: number } | { status: 'review', reason: string }`
    - Error apa pun selain keputusan "review" **dilempar** (watcher menganggapnya sementara dan mencoba ulang).

- [ ] **Step 1: Tambah prompt dan skema di `ai.js`**

Skema JSON mengikuti bentuk di spec (bagian "Alur per file" langkah 3), `transactions.items.required = ['date','amount','type','description','category_id']`, `type` dengan `enum`. Daftar kategori dikirim sebagai `id|nama|jenis` seperti `parseTransactionText`. Aturan prompt (`BANK_SYSTEM`):

```
Kamu membaca screenshot aplikasi bank / e-wallet Indonesia (bukti transfer, bukti pembayaran, atau daftar riwayat / mutasi). Balas HANYA JSON sesuai skema.
Aturan:
- bank: nama bank / e-wallet pemilik aplikasi (mis. "BCA", "SeaBank", "GoPay"), bukan bank lawan transaksi. null kalau tidak terlihat.
- transactions: satu baris per transaksi yang terlihat. Bukti transfer / pembayaran = 1 baris. Jangan mengarang baris.
- amount: bilangan bulat rupiah tanpa tanda. Titik = ribuan, koma = desimal: "Rp25.000,00" = 25000.
- type: "expense" untuk uang keluar (debit, DB, tanda -, transfer keluar, pembayaran), "income" untuk uang masuk (kredit, CR, tanda +, transfer masuk).
- date: yyyy-mm-dd. Kalau tahun tidak tertulis, pakai tahun dari hari ini. null kalau tidak ada.
- description: keterangan singkat (nama penerima / pengirim / merchant), tanpa nominal, maks 60 huruf.
- category_id: pilih dari daftar, hanya yang jenisnya sama dengan type, atau null.
- Abaikan saldo, biaya admin yang tidak tercatat sebagai baris terpisah, dan promo.
- confidence (0-1): turunkan kalau teks terpotong atau ragu.
```

- [ ] **Step 2: Tulis test `importScreenshot` yang gagal**

Pakai PNG palsu yang lolos magic bytes (`Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), Buffer.alloc(32)])`), `deps` palsu, dan `supabase` palsu yang mencatat panggilan:

```js
function fakeSupabase(existing = []) {
  const calls = { inserts: [] }
  const query = { select: () => query, eq: () => query, gte: () => query, lte: () => Promise.resolve({ data: existing, error: null }) }
  return {
    calls,
    from: () => ({
      ...query,
      insert: (rows) => { calls.inserts.push(rows); return Promise.resolve({ error: null }) },
    }),
  }
}
```

Test:
- `'bukan gambar -> review'` → `buffer = Buffer.from('halo')` → `status === 'review'`.
- `'lebih dari 4 MB -> review'` → PNG palsu ditambah `Buffer.alloc(4 * 1024 * 1024)` → `status === 'review'`.
- `'teks OCR pendek tanpa vision -> review'` → `RECEIPT_VISION_FALLBACK='false'`, `ocr` mengembalikan `'abc'` → `status === 'review'`, `parseText` tidak dipanggil.
- `'OCR gagal dengan vision -> parseImage dipakai'` → `RECEIPT_VISION_FALLBACK='true'`, `ocr` melempar → `parseImage` dipanggil sekali, `status === 'saved'`.
- `'AI 422 dari teks dengan vision -> coba gambar'` → `parseText` melempar `HttpError(422)`, `parseImage` berhasil → `status === 'saved'`.
- `'confidence rendah -> review'` → `confidence: 0.4` → `status === 'review'`, `calls.inserts.length === 0`.
- `'bank tidak dikenali -> review'` → `bank: 'Jago'` → reason mengandung `'Jago'`, tidak ada insert.
- `'baris baru disimpan dalam satu insert'` → 2 baris, `existing = []` → `calls.inserts.length === 1`, `calls.inserts[0].length === 2`, setiap baris punya `wallet_id: 'w-bca'`, `source: 'ai_receipt'`, `note`, `category_id`; hasil `{ status: 'saved', wallet: 'BCA', inserted: 2, skipped: 0 }`.
- `'semua sudah ada -> saved tanpa insert'` → `existing` = kedua baris → `inserted === 0`, `skipped === 2`, `calls.inserts.length === 0`.
- `'AI sibuk -> error dilempar'` → `parseText` melempar error dengan `retryable = true` → `importScreenshot` reject.
- `'insert gagal -> error dilempar'` → `insert` mengembalikan `{ error: { message: 'x' } }` → reject.

- [ ] **Step 3: Jalankan, pastikan gagal**

Run: `npm test -- lib/server/bankImport.test.js`
Expected: FAIL, `importScreenshot is not a function`

- [ ] **Step 4: Implementasi `importScreenshot`**

Urutan sesuai spec "Alur per file". Alur OCR → teks / vision meniru `parseReceipt` di `receipt.js:55-91` (OCR gagal dan teks pendek digabung jadi satu cabang). Query transaksi yang ada: `from('transactions').select('date, type, amount').eq('wallet_id', id).gte('date', minDate).lte('date', maxDate)`. Error query atau insert → `throw new Error(...)`. Pesan reason:
- `File bukan gambar JPG, PNG, atau WEBP`
- `Ukuran gambar lebih dari 4 MB`
- `Teks di screenshot tidak terbaca`
- `AI tidak yakin dengan hasil bacaannya (confidence ${x})`
- `Tidak ada transaksi yang terbaca`

- [ ] **Step 5: Jalankan semua test, pastikan lulus**

Run: `npm test`
Expected: semua PASS, termasuk test lama `receipt.test.js` dan lainnya

- [ ] **Step 6: Commit**

```bash
git add lib/server/ai.js lib/server/bankImport.js lib/server/bankImport.test.js
git commit -m "feat: import one bank screenshot into Monify"
```

---

### Task 4: Helper file inbox

**Files:**
- Create: `scripts/inboxFiles.mjs`
- Test: `scripts/inboxFiles.test.mjs`

**Interfaces:**
- Produces:
  - `isInboxImage(name: string) => boolean` — ekstensi di Global Constraints.
  - `listInbox(dir: string) => Promise<string[]>` — nama file (bukan folder) yang lolos `isInboxImage`, urut nama.
  - `uniqueName(dir: string, name: string) => Promise<string>` — `name` kalau `name` dan `<base>.txt` belum ada di `dir`; kalau ada, `<base> (2)<ext>`, `(3)`, dst.
  - `moveTo(fromDir, name, toDir, reason?) => Promise<string>` — pindah file ke `toDir` dengan `uniqueName`; kalau `reason` ada, tulis `<base akhir>.txt` berisi `reason`. Mengembalikan nama akhir. Pakai `fs.rename`, fallback `copyFile` + `unlink` kalau `EXDEV`.
  - `isStable(file: string, previousSize: number|undefined) => Promise<{ stable: boolean, size: number }>`

- [ ] **Step 1: Tulis test yang gagal**

Pakai folder sementara dari `fs.mkdtemp(path.join(os.tmpdir(), 'monify-inbox-'))`, dihapus di `after`.
- `'hanya gambar yang diproses'` → `isInboxImage('a.PNG') === true`, `'b.jpeg'` true, `'c.pdf'` false, `'d.png.tmp'` false.
- `'listInbox mengabaikan subfolder'` → folder berisi `a.png`, `b.txt`, subfolder `selesai/x.png` → `['a.png']`.
- `'nama bentrok diberi akhiran, termasuk txt'` → tujuan berisi `bca.png` → `uniqueName` = `'bca (2).png'`; tujuan hanya berisi `bca.txt` → juga `'bca (2).png'`.
- `'moveTo menulis alasan dengan nama yang sama'` → `moveTo(src, 'bca.png', dest, 'alasan')` saat `dest/bca.png` sudah ada → `dest/bca (2).png` dan `dest/bca (2).txt` berisi `'alasan'`, file asli `dest/bca.png` tidak berubah.
- `'file hilang saat dipindah -> error ENOENT'` → `moveTo` file yang tidak ada → reject dengan `code === 'ENOENT'`.
- `'isStable'` → panggilan pertama `stable === false`; panggilan kedua dengan ukuran sebelumnya yang sama → `stable === true`.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node --test scripts/inboxFiles.test.mjs`
Expected: FAIL, modul tidak ditemukan

- [ ] **Step 3: Implementasi `scripts/inboxFiles.mjs`**

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `node --test scripts/inboxFiles.test.mjs`, lalu `npm test`
Expected: semua PASS (pastikan `npm test` juga menemukan `*.test.mjs`)

- [ ] **Step 5: Commit**

```bash
git add scripts/inboxFiles.mjs scripts/inboxFiles.test.mjs
git commit -m "feat: inbox file helpers (list, unique name, move, stability)"
```

---

### Task 5: Skrip watcher, konfigurasi, dan dokumentasi

**Files:**
- Create: `scripts/watch-inbox.mjs`
- Modify: `package.json` (scripts)
- Modify: `.env.example`
- Modify: `README.md` (bagian "Menjalankan" dan "Variabel lingkungan")

**Interfaces:**
- Consumes: `importScreenshot` (Task 3), `loadUserLists` (`userData.js`), semua helper Task 4.

- [ ] **Step 1: Tambah script di `package.json`**

`"watch": "node --conditions=react-server --env-file=.env.local scripts/watch-inbox.mjs"`

- [ ] **Step 2: Implementasi `scripts/watch-inbox.mjs`**

1. Cek env wajib (`AI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `MONIFY_EMAIL`, `MONIFY_PASSWORD`); yang kosong disebut namanya, lalu `process.exit(1)`.
2. Buat folder inbox + `selesai` + `perlu-dicek` (`mkdir { recursive: true }`).
3. Client Supabase: `createClient(url, key, { auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false }, realtime: { transport: ws } })`, lalu `signInWithPassword`. Gagal → pesan `Login gagal: periksa MONIFY_EMAIL / MONIFY_PASSWORD` dan exit 1.
4. Loop: setiap 5 detik `listInbox`; untuk tiap file, tunggu `isStable` (simpan ukuran sebelumnya di `Map`), lalu proses satu per satu. `loadUserLists` dipanggil sekali per putaran yang punya file stabil, supaya dompet / kategori baru langsung terpakai.
5. Hasil:
   - `saved` → `moveTo(..., selesai)`, log `✓ ${name} → ${inserted} baru, ${skipped} sudah ada (${wallet})` + `, ${dropped} baris tidak terbaca` kalau `dropped > 0`.
   - `review` → `moveTo(..., perlu-dicek, reason)`, log `⚠ ${name} → perlu dicek: ${reason}`.
   - error dilempar → tambah hitungan di `Map`; log `… ${name} → gagal sementara, dicoba lagi (${n}/3)`; pada percobaan ke-3 → `moveTo(..., perlu-dicek, 'Gagal 3 kali: ' + pesan aman)`. Pesan aman = `err.message` kalau `err instanceof HttpError`, selain itu `'kesalahan tidak terduga'`.
   - Error `ENOENT` saat membaca / memindah → log `${name} sudah tidak ada, dilewati` dan lanjut.
6. Satu putaran tidak boleh tumpang-tindih dengan putaran berikutnya (pakai `setTimeout` setelah putaran selesai, bukan `setInterval`).
7. Log awal: lokasi folder inbox dan email yang login.

- [ ] **Step 3: Tambah env di `.env.example` dan README**

`.env.example`, bagian baru di akhir:
```
# Folder inbox screenshot bank (npm run watch). Hanya untuk laptop sendiri, jangan diisi di Vercel.
# MONIFY_INBOX=C:\Users\nama\Pictures\Monify Inbox
MONIFY_EMAIL=
MONIFY_PASSWORD=
```
README: satu baris `npm run watch` di "Menjalankan", tiga baris di tabel "Variabel lingkungan", dan satu paragraf singkat tentang folder `selesai/` / `perlu-dicek/` serta peringatan bahwa password tersimpan sebagai teks biasa di `.env.local`.

- [ ] **Step 4: Cek konfigurasi yang kurang**

Run: `npm run watch` dengan `MONIFY_EMAIL` belum diisi
Expected: pesan menyebut `MONIFY_EMAIL`, keluar dengan kode 1, tidak ada folder yang dibuat selain yang sudah ada

- [ ] **Step 5: Commit**

```bash
git add scripts/watch-inbox.mjs package.json .env.example README.md
git commit -m "feat: npm run watch for bank screenshot inbox"
```

---

### Task 6: Uji manual end-to-end

Butuh user: `MONIFY_EMAIL` / `MONIFY_PASSWORD` di `.env.local`, dompet "BCA" (atau bank lain yang dipakai) di Monify, dan screenshot asli.

- [ ] **Step 1:** `npm run watch`. Expected: log lokasi folder dan email, folder `Monify Inbox/selesai` dan `perlu-dicek` ada.
- [ ] **Step 2:** Taruh satu bukti transfer. Expected: `✓ … 1 baru`, file di `selesai/`, transaksi muncul di halaman Transaksi web dengan dompet dan tanggal benar.
- [ ] **Step 3:** Taruh satu screenshot mutasi berisi pemasukan dan pengeluaran. Expected: jumlah baris benar, jenis income / expense benar, saldo dompet berubah sesuai.
- [ ] **Step 4:** Taruh salinan screenshot mutasi yang sama (nama berbeda). Expected: `0 baru, N sudah ada`.
- [ ] **Step 5:** Taruh screenshot dari bank yang tidak ada di dompet. Expected: file + `.txt` di `perlu-dicek/` dengan nama bank.
- [ ] **Step 6:** Taruh file `.pdf` dan file `.png` yang sebenarnya teks. Expected: `.pdf` diabaikan dan tetap di folder utama; `.png` palsu → `perlu-dicek/` ("bukan gambar").
- [ ] **Step 7:** Matikan skrip (Ctrl+C), taruh satu screenshot, nyalakan lagi. Expected: file itu diproses saat start.
- [ ] **Step 8:** Catat hasil dan perbaiki kalau ada yang gagal (kembali ke task terkait, tambah test dulu).
