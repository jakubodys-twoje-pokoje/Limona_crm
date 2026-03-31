import { type ClassValue, clsx } from 'clsx'

// Lightweight cn utility without tailwind-merge dependency
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatMoney(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value).replace(/\u00A0/g, ' ') + ' zł'
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return '—'
  return (value * 100).toFixed(1) + '%'
}

export function formatPercentRaw(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toFixed(1) + '%'
}
