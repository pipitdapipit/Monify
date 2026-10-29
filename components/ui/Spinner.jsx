export default function Spinner({ className = 'h-8 w-8' }) {
  return (
    <div
      role="status"
      aria-label="Memuat"
      className={`animate-spin rounded-full border-4 border-teal-100 border-t-teal-600 ${className}`}
    />
  )
}
