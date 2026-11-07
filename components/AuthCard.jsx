import Contour from '@/components/Contour'

// Bingkai bersama untuk halaman Login dan Register.
export default function AuthCard({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <Contour />
      <div className="relative w-full max-w-sm">
        <p className="text-5xl font-bold tracking-tighter">Monify</p>
        <h1 className="mt-6 text-xl font-bold">{title}</h1>
        <p className="mt-1 mb-6 text-sm text-mute">{subtitle}</p>
        {children}
      </div>
    </div>
  )
}
