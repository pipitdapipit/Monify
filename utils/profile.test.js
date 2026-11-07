import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildProfile } from './profile.js'

// Siklus 1-10 Nov, hari ini 7 Nov (days_left 4), jatah 100rb/hari -> sisa 400rb
const safe = { cycle_start: '2026-11-01', cycle_end: '2026-11-10', days_left: 4, amount: 100 }
const daily = [
  { date: '2026-11-01', income: 1000, expense: 0 },
  { date: '2026-11-05', income: 0, expense: 20 },
  { date: '2026-11-06', income: 0, expense: 30 },
  { date: '2026-11-07', income: 0, expense: 50 },
]

test('satu titik per hari di siklus, hari ini ada di indeks yang benar', () => {
  const p = buildProfile(safe, daily)
  assert.equal(p.points.length, 10)
  assert.equal(p.points[0].date, '2026-11-01')
  assert.equal(p.points[9].date, '2026-11-10')
  assert.equal(p.todayIndex, 6)
})

test('hari ini bernilai sisa uang aman (jatah x sisa hari)', () => {
  assert.equal(buildProfile(safe, daily).points[6].value, 400)
})

test('hari lampau dihitung mundur dari pengeluaran dan pemasukan sesudahnya', () => {
  const v = buildProfile(safe, daily).points.map((x) => x.value)
  assert.equal(v[5], 450) // 6 Nov: + pengeluaran 7 Nov
  assert.equal(v[4], 480) // 5 Nov: + pengeluaran 6 dan 7 Nov
  assert.equal(v[3], 500) // 4 Nov: + pengeluaran 5, 6, 7 Nov
  assert.equal(v[0], 500) // 1 Nov: gaji hari itu sudah termasuk
})

test('hari mendatang turun satu jatah per hari menuju nol', () => {
  const v = buildProfile(safe, daily).points.map((x) => x.value)
  assert.deepEqual(v.slice(6), [400, 300, 200, 100])
})

test('hari yang tidak ada di data harian dianggap nol', () => {
  const p = buildProfile(safe, [])
  assert.equal(p.points[0].value, 400)
  assert.equal(p.points[2].value, 400)
})

test('titik ditandai lampau atau mendatang, hari ini termasuk lampau', () => {
  const p = buildProfile(safe, daily)
  assert.equal(p.points[6].past, true)
  assert.equal(p.points[7].past, false)
})

test('sisa hari lebih panjang dari siklus -> hari ini ditahan di awal siklus', () => {
  const p = buildProfile({ ...safe, days_left: 30 }, daily)
  assert.equal(p.todayIndex, 0)
})

test('rentang nilai (min dan max) ikut dikembalikan, tidak pernah sama', () => {
  const p = buildProfile(safe, [])
  assert.equal(p.max > p.min, true)
  const flat = buildProfile({ ...safe, amount: 0 }, [])
  assert.equal(flat.max > flat.min, true)
})

test('data belum ada -> null', () => {
  assert.equal(buildProfile(null, daily), null)
  assert.equal(buildProfile(safe, null), null)
})
