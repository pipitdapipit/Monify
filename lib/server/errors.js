import 'server-only'
// Error yang aman ditampilkan ke user: status HTTP + pesan Indonesia.
export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
