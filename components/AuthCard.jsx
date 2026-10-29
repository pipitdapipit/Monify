// Bingkai bersama untuk halaman Login dan Register.
export default function AuthCard({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-teal-50 to-slate-50 dark:from-teal-950 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-xl font-bold text-white">
            M
          </span>
          <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  )
}
