# Folder Inbox Screenshot Bank — Design

Tanggal: 2026-11-02

## Tujuan

User tidak perlu membuka web Monify untuk mencatat transaksi dari bank. Cukup taruh screenshot
aplikasi bank / e-wallet ke satu folder di laptop, dan transaksinya otomatis tersimpan di Monify.

Kriteria berhasil:
- Screenshot yang ditaruh di folder inbox diproses tanpa interaksi: transaksi tersimpan ke akun
  Monify user, lalu file dipindah ke `selesai/`.
- Satu screenshot bisa berisi **satu transaksi** (bukti transfer / pembayaran) atau **daftar
  transaksi** (riwayat / mutasi rekening).
- Pengeluaran dan pemasukan sama-sama dicatat.
- Dompet ditentukan dari bank di screenshot. Kalau bank tidak cocok dengan dompet mana pun,
  file tidak disimpan dan dipindah ke `perlu-dicek/` beserta alasannya.
- Screenshot yang sama atau yang tumpang-tindih tidak membuat transaksi ganda.

Di luar cakupan versi pertama:
- Struk kertas dari toko / warung (tetap lewat halaman scan struk di web).
- Sumber selain folder di laptop (galeri HP, Google Drive, Shortcut iOS).
- Menjalankan otomatis saat Windows menyala (bisa ditambah nanti lewat Task Scheduler).
- Endpoint API baru di Vercel. Tidak ada perubahan pada web app maupun skema database.

## Pendekatan

Watcher lokal yang memproses semuanya di laptop (pendekatan A). Satu skrip Node memantau folder,
menjalankan OCR + AI memakai kode `lib/server` yang sudah ada (seperti `scripts/receipt-cli.mjs`),
lalu menyimpan langsung ke Supabase atas nama user.

Alasan: OCR (LiteParse) terbukti jalan di laptop, sedangkan di Vercel bermasalah. Tidak perlu
endpoint baru. Kalau nanti ingin dari HP, logika parse-dan-simpan di `lib/server/bankImport.js`
bisa dipanggil dari route API tanpa ditulis ulang.

Pendekatan yang tidak dipilih:
- Watcher hanya upload ke endpoint Vercel: bergantung pada OCR di Vercel atau vision yang lebih
  mahal, dan lebih banyak bagian yang harus diamankan.
- Supabase Storage + Edge Function: berlebihan untuk satu laptop.

## Folder

```
Monify Inbox/            screenshot baru ditaruh di sini (antrian)
├── selesai/             sudah tersimpan ke Monify
└── perlu-dicek/         tidak disimpan; tiap file disertai <nama>.txt berisi alasan
```

- Lokasi default `%USERPROFILE%\Pictures\Monify Inbox`, bisa diganti dengan `MONIFY_INBOX`
  di `.env.local`. Folder dan subfolder dibuat otomatis kalau belum ada.
- Folder ada di luar repo: screenshot bank berisi data pribadi dan tidak boleh masuk git.
- Hanya file `.jpg`, `.jpeg`, `.png`, `.webp` di folder utama yang diproses. Subfolder dan file
  jenis lain diabaikan.
- File yang selesai diproses **dipindah**, tidak pernah dihapus. Kalau nama sudah ada di folder
  tujuan, ditambah akhiran: `bca.png` → `bca (2).png`. Tidak ada file yang tertimpa.

## Menjalankan

- `npm run watch` → `node --conditions=react-server --env-file=.env.local scripts/watch-inbox.mjs`
  (flag sama dengan `test:receipt`, supaya `server-only` bisa di-import).
- Saat start: cek konfigurasi, login, lalu proses file yang sudah menumpuk di folder.
- Setelah itu folder dicek **setiap 5 detik** (polling). `fs.watch` tidak dipakai karena kurang
  andal di Windows / folder OneDrive. Tidak ada dependency baru.
- File diproses **satu per satu**, tidak paralel: menghindari rate limit AI dan menjaga
  pengecekan duplikat antar-screenshot konsisten.
- File baru dibaca setelah ukurannya stabil di dua pengecekan berturut-turut (alat screenshot dan
  OneDrive sering menulis file bertahap).
- Satu baris log per file, contoh:
  ```
  ✓ bca-0312.png → 3 baru, 1 sudah ada (BCA)
  ⚠ img_22.jpg → perlu dicek: bank "Jago" tidak ada di dompet Monify
  … seabank.png → AI sibuk, dicoba lagi nanti (1/3)
  ```
  Teks OCR dan isi transaksi (nominal, keterangan) tidak dicetak.

## Alur per file

1. **Cek file.** Jenis dari magic bytes (`detectImageType`), ukuran maksimal 4 MB. Gagal →
   `perlu-dicek/`.
2. **OCR** dengan `ocrImage` (LiteParse). Kalau OCR gagal atau teks < 20 karakter:
   - `RECEIPT_VISION_FALLBACK=true` → gambar dikirim langsung ke AI;
   - selain itu → `perlu-dicek/` ("teks tidak terbaca").
3. **AI** dengan prompt dan skema baru khusus screenshot bank (prompt struk yang lama tidak
   diubah). Bentuk balasan yang diminta:
   ```
   {
     bank: string | null,          // nama bank / e-wallet yang terlihat, mis. "BCA", "SeaBank"
     transactions: [
       { date: string | null,      // yyyy-mm-dd
         amount: integer,          // rupiah, > 0
         type: "income" | "expense",
         description: string,      // keterangan singkat dari screenshot
         category_id: string | null }
     ],
     confidence: number            // 0-1
   }
   ```
   Bukti transfer → array berisi 1 transaksi; mutasi → banyak. Model diberi daftar kategori user
   (`id|nama|jenis`), seperti `parseTransactionText`. Kalau model gagal membaca teks OCR (422) dan
   vision fallback aktif, gambar dicoba sekali lewat vision, sama seperti alur struk.
4. **Validasi output AI** (zod, dianggap tidak tepercaya). Per baris:
   - `amount` bilangan bulat > 0 dan ≤ batas `MAX_RUPIAH` yang sudah ada; selain itu baris dibuang.
   - `type` harus `income`/`expense`; selain itu baris dibuang.
   - `date` lewat `validDateOrToday` (tanggal tidak valid / masa depan → hari ini).
   - `description` dipotong maksimal 60 karakter, jadi `note`.
   Baris yang dibuang dihitung dan disebut di log.
5. **Pencocokan dompet oleh kode, bukan AI.** `bank` dan nama setiap dompet dinormalisasi
   (huruf kecil, hanya huruf dan angka: "Sea Bank" → "seabank"). Dompet cocok kalau hasil
   normalisasinya sama. Tidak ada yang cocok, `bank` kosong, atau lebih dari satu dompet cocok →
   seluruh file ke `perlu-dicek/` dengan nama bank yang terbaca di alasannya.
6. **Kategori.** `category_id` dari AI dipakai kalau milik user dan jenisnya sama dengan `type`.
   Selain itu dipakai kategori bernama "Lainnya" dengan jenis yang sama (ada di kategori bawaan).
   Kalau user tidak punya "Lainnya" untuk jenis itu → file ke `perlu-dicek/`.
7. **Keputusan per file.**
   - `confidence` < 0.5, atau tidak ada baris valid → `perlu-dicek/`.
   - Selain itu → cek duplikat (bagian berikut), simpan baris yang baru, pindah ke `selesai/`.
     Kalau semua baris sudah ada, tetap ke `selesai/` dengan log "0 baru, N sudah ada".
8. **Simpan** semua baris baru dalam **satu** `insert` (satu statement SQL, jadi semua tersimpan
   atau tidak sama sekali), dengan `source = 'ai_receipt'`. Nilai itu sudah diizinkan constraint
   `transactions.source`, jadi tidak perlu migration.

## Pencegahan duplikat

Kunci transaksi: **dompet + tanggal + jenis + nominal**. Keterangan sengaja tidak dipakai, karena
AI bisa menulis deskripsi berbeda setiap membaca dan input manual user memakai keterangan sendiri.

Untuk setiap kunci di satu screenshot:

```
disimpan = max(0, jumlah di screenshot − jumlah transaksi yang sudah ada di Monify)
```

Transaksi yang sudah ada diambil dengan satu query ke `transactions` milik user untuk dompet itu,
pada rentang tanggal minimum–maksimum di screenshot.

| Kasus (kopi Rp25.000 dua kali, 3 Nov, BCA) | Di screenshot | Sudah ada | Disimpan |
|---|---|---|---|
| Screenshot pertama | 2 | 0 | 2 |
| Screenshot yang sama masuk lagi | 2 | 2 | 0 |
| Screenshot tumpang-tindih yang memuat salah satunya | 1 | 2 | 0 |

Batasan yang diterima: dua transaksi identik (dompet, tanggal, jenis, nominal sama) yang muncul di
dua screenshot **terpisah** tanpa tumpang-tindih → yang kedua dianggap duplikat dan dilewati. Log
menyebut jumlah yang dilewati supaya user bisa menambahkannya manual. Menambah jam transaksi ke
kunci tidak termasuk versi pertama.

## Login

- `MONIFY_EMAIL` dan `MONIFY_PASSWORD` di `.env.local` (sudah di-ignore git lewat `.env.*`).
- Skrip membuat client Supabase sendiri dengan publishable key, `signInWithPassword` sekali saat
  start, dan `autoRefreshToken: true` supaya sesi tetap hidup selama skrip berjalan. Semua query
  berjalan sebagai user, jadi RLS berlaku. Tidak ada service / secret key.
- Konsekuensi yang diketahui user: password akun tersimpan sebagai teks biasa di laptop.

## Penanganan error

| Jenis | Contoh | Tindakan |
|---|---|---|
| Masalah file | bukan gambar, > 4 MB, teks tidak terbaca, bank tidak dikenali, confidence rendah, tidak ada baris valid, tidak ada kategori "Lainnya" | pindah ke `perlu-dicek/` + `<nama>.txt` berisi alasan |
| Sementara | AI sibuk / timeout (`retryable`, 5xx), internet putus, Supabase error saat query/insert | file tetap di folder utama, dicoba di putaran berikutnya; setelah gagal 3 kali → `perlu-dicek/` |
| Fatal | env wajib kosong (`AI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `MONIFY_EMAIL`, `MONIFY_PASSWORD`), login gagal | skrip berhenti dengan pesan jelas, tidak ada file yang dipindah |

Hitungan percobaan disimpan di memori skrip (hilang saat skrip restart, dan itu tidak masalah).

## Susunan file

| File | Isi |
|---|---|
| `lib/server/ai.js` | Prompt + skema + `parseBankScreenshotText` / `parseBankScreenshotImage` (semua kode AI tetap di file ini) |
| `lib/server/schemas.js` | Skema zod output AI screenshot bank |
| `lib/server/bankImport.js` *(baru)* | Logika murni: `normalizeBankName`, `matchWallet`, `cleanBankScreenshot`, `planInserts` (selisih duplikat), dan `importScreenshot` yang merangkai OCR → AI → validasi → dedup → insert dan mengembalikan keputusan (`saved` / `review` + alasan / `retry`) |
| `lib/server/bankImport.test.js` *(baru)* | Unit test untuk fungsi murni di atas |
| `scripts/watch-inbox.mjs` *(baru)* | Konfigurasi, login, polling folder, cek ukuran stabil, memindah file, menulis `.txt` alasan, log |
| `package.json` | Script `"watch"` |
| `.env.example`, `README.md` | `MONIFY_INBOX`, `MONIFY_EMAIL`, `MONIFY_PASSWORD`, cara pakai |

`bankImport.js` tidak menyentuh filesystem; `watch-inbox.mjs` tidak berisi logika parsing. Batas
ini yang memungkinkan logika dipakai ulang dari route API di masa depan.

## Pengujian

- Unit test (`node --test`, pola `*.test.js` yang sudah ada), ditulis sebelum kodenya:
  - normalisasi & pencocokan dompet: "Sea Bank" ↔ "SeaBank", tidak cocok, cocok ganda;
  - `planInserts`: tiga baris tabel duplikat di atas;
  - pembersihan output AI: nominal 0 / negatif / pecahan dibuang, `type` aneh dibuang, tanggal
    masa depan → hari ini, keterangan dipotong 60 karakter, kategori tidak valid → "Lainnya";
  - keputusan file: confidence rendah, tanpa baris valid, bank tidak dikenali.
- Uji manual dengan screenshot asli: satu bukti transfer, satu mutasi berisi beberapa baris
  (pemasukan + pengeluaran), satu dari bank yang tidak ada di dompet, satu screenshot yang
  dimasukkan dua kali, dan satu file non-gambar.
