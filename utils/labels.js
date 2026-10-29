// Teks tampilan untuk nilai-nilai dari API.

export const walletTypes = [
  { value: 'cash', label: 'Tunai', icon: '💵' },
  { value: 'bank', label: 'Bank', icon: '🏦' },
  { value: 'ewallet', label: 'E-wallet', icon: '📱' },
]

export function walletTypeLabel(type) {
  return walletTypes.find((t) => t.value === type)?.label || type
}

export function walletTypeIcon(type) {
  return walletTypes.find((t) => t.value === type)?.icon || '👛'
}
