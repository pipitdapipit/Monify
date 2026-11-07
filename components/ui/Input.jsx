// Input teks dengan label dan pesan error opsional.
export default function Input({ label, error, id, className = '', ...props }) {
  const inputId = id || props.name
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1 block text-xs text-mute">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full border-0 border-b-[1.5px] bg-transparent px-0 py-2 text-base outline-none focus:border-acc ${
          error ? 'border-red-400' : 'border-slate-300'
        }`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
