import { addDays, parseISODate } from './date.js'

// Profil "pendakian" di Beranda: sisa uang aman di tiap hari sepanjang siklus gajian.
//
//   hari ini  = jatah per hari x sisa hari (sama dengan angka di database)
//   lampau    = dihitung mundur dari hari ini: nilai sebelum hari itu = nilai sesudahnya
//               ditambah pengeluaran dan dikurangi pemasukan hari sesudahnya
//   mendatang = turun satu jatah per hari menuju nol (proyeksi kalau jatah dipakai habis)
//
// safe  = hasil safe_to_spend  { cycle_start, cycle_end, days_left, amount }
// daily = overview.daily       [{ date, income, expense }]
// -> { points: [{ date, value, past }], todayIndex, min, max } atau null kalau data belum ada.
const DAY_MS = 86400000

export function buildProfile(safe, daily) {
  if (!safe || !daily) return null

  const start = parseISODate(safe.cycle_start)
  const end = parseISODate(safe.cycle_end)
  const length = Math.round((end - start) / DAY_MS) + 1

  // Hari ini = hari sebelum gajian berikutnya, mundur sebanyak sisa hari
  const today = addDays(safe.cycle_end, 1 - safe.days_left)
  const raw = Math.round((parseISODate(today) - start) / DAY_MS)
  const todayIndex = Math.min(Math.max(raw, 0), length - 1)

  const byDate = new Map(daily.map((d) => [d.date, d]))
  const net = (date) => {
    const d = byDate.get(date)
    return d ? Number(d.expense) - Number(d.income) : 0
  }

  const values = new Array(length)
  values[todayIndex] = safe.amount * safe.days_left
  for (let i = todayIndex - 1; i >= 0; i--) {
    values[i] = values[i + 1] + net(addDays(safe.cycle_start, i + 1))
  }
  for (let i = todayIndex + 1; i < length; i++) {
    values[i] = Math.max(0, values[todayIndex] - safe.amount * (i - todayIndex))
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  return {
    points: values.map((value, i) => ({ date: addDays(safe.cycle_start, i), value, past: i <= todayIndex })),
    todayIndex,
    min,
    max: max > min ? max : min + 1,
  }
}
