import 'server-only'
// Tanggal hari ini di Asia/Jakarta, format yyyy-mm-dd (locale en-CA memberi format itu).
export function todayJakarta() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}
