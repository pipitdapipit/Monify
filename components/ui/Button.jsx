import Spinner from '@/components/ui/Spinner'

const variants = {
  primary: 'bg-acc text-on-acc hover:opacity-90 disabled:opacity-50',
  secondary: 'border border-line text-ink hover:bg-soft disabled:text-slate-400',
  danger: 'bg-red-600 text-on-acc hover:opacity-90 disabled:opacity-50',
  ghost: 'text-teal-700 hover:bg-teal-50',
}

// loading=true -> tombol nonaktif + spinner, mencegah klik dobel.
export default function Button({
  children,
  variant = 'primary',
  loading = false,
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={loading || props.disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4 border-2" />}
      {children}
    </button>
  )
}
