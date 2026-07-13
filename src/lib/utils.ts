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

export function formatPropertyAddress(p: { adres: string; kod_pocztowy?: string | null; miasto?: string | null }): string {
  const cityLine = [p.kod_pocztowy, p.miasto].filter(Boolean).join(' ')
  return [p.adres, cityLine].filter(Boolean).join(', ')
}

/**
 * Termin jest przeterminowany dopiero NASTĘPNEGO dnia po due_date — porównanie
 * `new Date(due_date) < new Date()` traktowało due_date jako północ UTC, więc
 * zadanie "na dziś" pokazywało się jako przeterminowane już od ~2:00 czasu PL.
 * Porównujemy więc same klucze dat (YYYY-MM-DD), niezależnie od strefy czasowej.
 */
export function isOverdueDate(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false
  const now = new Date()
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return dueDate.slice(0, 10) < todayKey
}

export type SortDirection = 'asc' | 'desc'

/** Sortuje po `created_at` — 'desc' (najnowsze na górze, jak w Trello) albo 'asc'. */
export function sortByCreatedAt<T extends { created_at: string }>(items: T[], dir: SortDirection): T[] {
  const sorted = [...items].sort((a, b) => a.created_at.localeCompare(b.created_at))
  return dir === 'desc' ? sorted.reverse() : sorted
}
