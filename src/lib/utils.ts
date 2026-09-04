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

/**
 * Czy zadanie pasuje do filtra po agencie — pusty filtr przepuszcza
 * wszystko, inaczej agent musi być głównym wykonawcą lub współwykonawcą.
 */
export function taskMatchesAssignee(
  task: { assigned_to: string | null; co_assignees?: string[] | null },
  assigneeId: string,
): boolean {
  if (!assigneeId) return true
  return task.assigned_to === assigneeId || !!task.co_assignees?.includes(assigneeId)
}

/** Ile pełnych dni minęło od podanej daty (null, gdy brak daty) */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  return Math.floor(ms / 86400000)
}

/**
 * Poziom „świeżości" aktywności do podświetlania braku kontaktu:
 *  - 'stale' (czerwony) — ponad 2 tygodnie bez aktywności,
 *  - 'warn'  (żółty)    — ponad tydzień bez aktywności,
 *  - null               — świeże / brak daty.
 */
export function activityStaleness(iso: string | null | undefined): 'warn' | 'stale' | null {
  const d = daysSince(iso)
  if (d == null) return null
  if (d >= 14) return 'stale'
  if (d >= 7) return 'warn'
  return null
}

// Okna filtra „po aktywności" — etykieta + liczba dni
export const ACTIVITY_WINDOWS: { value: string; label: string; days: number }[] = [
  { value: '1d', label: '1 dzień', days: 1 },
  { value: '1w', label: '1 tydzień', days: 7 },
  { value: '2w', label: '2 tygodnie', days: 14 },
  { value: '1m', label: '1 miesiąc', days: 30 },
]

/** Czy data aktywności mieści się w wybranym oknie (aktywne w ostatnich N dniach) */
export function withinActivityWindow(iso: string | null | undefined, windowValue: string): boolean {
  if (!windowValue) return true
  const win = ACTIVITY_WINDOWS.find(w => w.value === windowValue)
  if (!win) return true
  const d = daysSince(iso)
  return d != null && d <= win.days
}

export type SortDirection = 'asc' | 'desc'

/** Sortuje po `created_at` — 'desc' (najnowsze na górze, jak w Trello) albo 'asc'. */
/**
 * Normalizuje adres strony wpisany bez „https://" — dokleja protokół, żeby
 * dało się zapisać „firma.pl" / „www.firma.pl", a link i tak działał.
 */
export function normalizeUrl(v: string | null | undefined): string | null {
  const s = (v || '').trim()
  if (!s) return null
  if (/^https?:\/\//i.test(s)) return s
  return `https://${s}`
}

export function sortByCreatedAt<T extends { created_at: string }>(items: T[], dir: SortDirection): T[] {
  const sorted = [...items].sort((a, b) => a.created_at.localeCompare(b.created_at))
  return dir === 'desc' ? sorted.reverse() : sorted
}

/**
 * Zadania zrobione na dół listy, niezrobione na górze — bez zmiany kolejności
 * w obrębie grupy (sort stabilny). Używane w listach zadań na kartach encji,
 * gdzie agent trzyma „do zrobienia" pod ręką, a domknięte schodzą z oczu.
 */
export function sortTasksDoneLast<T extends { status: string }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0))
}
