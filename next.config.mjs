/** @type {import('next').NextConfig} */
const nextConfig = {
  // LiteParse memanggil binary bawaan (Tesseract / pdfium), jadi jangan di-bundle.
  serverExternalPackages: ['@llamaindex/liteparse'],
  // Pastikan binary LiteParse ikut terbawa ke fungsi serverless route yang menjalankan OCR.
  outputFileTracingIncludes: {
    '/api/ai/parse-receipt': ['./node_modules/@llamaindex/liteparse*/**/*'],
    '/api/import/bank-screenshot': ['./node_modules/@llamaindex/liteparse*/**/*'],
  },
}

export default nextConfig
