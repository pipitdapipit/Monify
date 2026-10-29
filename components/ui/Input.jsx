// Input teks dengan label dan pesan error opsional.
export default function Input({ label, error, id, className = '', ...props }) {
  const inputId = id || props.name
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-500 ${
          error ? 'border-red-400' : 'border-slate-200'
        }`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
