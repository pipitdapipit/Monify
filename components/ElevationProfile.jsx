import { formatShortDate } from '@/utils/date'
import Skeleton from '@/components/ui/Skeleton'

const W = 260

// Profil "pendakian" sisa uang sepanjang siklus gajian (data dari utils/profile.js).
// Garis tebal = sampai hari ini, putus-putus = proyeksi kalau jatah dipakai habis,
// bendera = hari ini. Semua warna dari token, jadi ikut tema.
export default function ElevationProfile({ profile, height = 128 }) {
  if (!profile) return <Skeleton className="mt-4 w-full" style={{ height: height + 16 }} />

  const { points, todayIndex, min, max } = profile
  const n = points.length
  const base = height - 6
  const x = (i) => 8 + (i * (W - 16)) / Math.max(n - 1, 1)
  const y = (v) => 8 + ((max - v) / (max - min)) * (base - 16)
  const pts = (list) => list.map(({ i, v }) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  const past = points.slice(0, todayIndex + 1).map((p, i) => ({ i, v: p.value }))
  const future = points.slice(todayIndex).map((p, k) => ({ i: todayIndex + k, v: p.value }))
  const fx = x(todayIndex)
  const fy = y(points[todayIndex].value)

  return (
    <div className="mt-4">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        role="img"
        aria-label="Sisa uang aman sepanjang siklus gajian"
        className="block w-full"
      >
        {[1, 2, 3].map((k) => (
          <line
            key={k}
            x1="0"
            x2={W}
            y1={8 + (k * (base - 16)) / 4}
            y2={8 + (k * (base - 16)) / 4}
            stroke="var(--line)"
            strokeDasharray="2 4"
          />
        ))}
        <path d={`M${x(0)} ${base} L${pts(past).split(' ').join(' L')} L${fx} ${base} Z`} fill="var(--acc)" fillOpacity=".14" />
        <polyline points={pts(past)} fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        <polyline
          points={pts(future)}
          fill="none"
          stroke="var(--mute)"
          strokeWidth="1.6"
          strokeDasharray="3 3"
          strokeLinecap="round"
        />
        <line x1={fx} x2={fx} y1={fy} y2={fy - 24} stroke="var(--acc)" strokeWidth="2" />
        <path d={`M${fx} ${fy - 24} l15 5 l-15 5 Z`} fill="var(--acc)" />
        <circle cx={fx} cy={fy} r="3.6" fill="var(--bg)" stroke="var(--acc)" strokeWidth="2.2" />
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] tracking-wide text-mute uppercase">
        <span>{formatShortDate(points[0].date)}</span>
        <span>Hari ini</span>
        <span>{formatShortDate(points[n - 1].date)}</span>
      </div>
    </div>
  )
}
