import { redirect } from 'next/navigation'

// Alamat yang tidak dikenal kembali ke Beranda (sama seperti versi lama)
export default function NotFound() {
  redirect('/')
}
