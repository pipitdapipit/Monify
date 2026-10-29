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
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-500">Rp</span>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="0"
        value={value ? formatThousands(value) : ''}
        onChange={handleChange}
        className={`${fieldClass(error, highlight)} pl-10 text-base font-semibold`}
      />
    </div>
  )
}
