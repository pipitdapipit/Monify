import Spinner from '@/components/ui/Spinner'

const variants = {
  primary: 'bg-teal-600 text-white hover:bg-teal-700 disabled:bg-teal-300',
  secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:text-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
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
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4 border-2" />}
      {children}
    </button>
  )
}
