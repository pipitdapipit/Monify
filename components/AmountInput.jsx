'use client'

import { formatThousands } from '@/utils/formatRupiah'
import { parseAmountInput } from '@/utils/parseAmountInput'
import { fieldClass } from '@/components/ui/Field'

// Batas atas supaya angka tetap aman sebagai integer JavaScript.
const MAX_AMOUNT = 999999999999

// Input nominal: tampil "25.000", tapi value/onChange selalu integer (25000).
export default function AmountInput({ id, value, onChange, error, highlight, autoFocus }) {
  function handleChange(e) {
    const amount = parseAmountInput(e.target.value)
    if (amount <= MAX_AMOUNT) onChange(amount)
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 text-lg text-mute">Rp</span>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="0"
        value={value ? formatThousands(value) : ''}
        onChange={handleChange}
        className={`${fieldClass(error, highlight)} pl-9 text-3xl font-extrabold tracking-tight`}
      />
    </div>
  )
}
