// Pembungkus label + input + pesan, untuk form yang memakai <select>, dll.
// highlight=true -> bingkai kuning "Cek lagi" (dipakai saat AI kurang yakin).
export default function Field({ label, htmlFor, error, highlight, children }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor={htmlFor} className="text-xs text-mute">
          {label}
        </label>
        {highlight && !error && <span className="text-xs font-medium text-amber-600">Cek lagi</span>}
      </div>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

// Kelas CSS untuk input/select di dalam Field.
export function fieldClass(error, highlight) {
  const border = error ? 'border-red-400' : highlight ? 'border-amber-400 field-warn' : 'border-slate-300'
  return `w-full border-0 border-b-[1.5px] bg-transparent px-0 py-2 text-base outline-none focus:border-acc disabled:opacity-50 ${border}`
}
