/** @type {import('next').NextConfig} */
const nextConfig = {
  // LiteParse memanggil binary bawaan (Tesseract / pdfium), jadi jangan di-bundle.
  serverExternalPackages: ['@llamaindex/liteparse'],
  // Pastikan binary LiteParse ikut terbawa ke fungsi serverless route struk.
  outputFileTracingIncludes: {
    '/api/ai/parse-receipt': ['./node_modules/@llamaindex/liteparse*/**/*'],
  },
}

export default nextConfig
