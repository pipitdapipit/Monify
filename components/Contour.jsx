// Garis kontur peta di latar belakang: cincin tak beraturan yang berpusat di pojok kanan bawah.
// Dibuat sekali (deterministik, tanpa acak), warna dari token --contour, jadi ikut tema.
function ring(n) {
  const r = 24 + n * 70
  let d = ''
  for (let a = 0; a <= 72; a++) {
    const t = (a / 72) * Math.PI * 2
    const k = 1 + 0.16 * Math.sin(3 * t + n * 0.5) + 0.09 * Math.sin(5 * t + 2 + n)
    const x = (360 + Math.cos(t) * r * k * 1.05).toFixed(1)
    const y = (640 + Math.sin(t) * r * k * 1.3).toFixed(1)
    d += `${a ? 'L' : 'M'}${x} ${y}`
  }
  return `${d}Z`
}

const PATHS = Array.from({ length: 11 }, (_, n) => ring(n))

export default function Contour() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 800"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none fixed inset-0 h-full w-full"
    >
      {PATHS.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--contour)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}
