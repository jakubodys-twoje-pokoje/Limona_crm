import type { RecurrenceFreq } from '@/types/database'

const MAX_OCCURRENCES = 104

// Domyślny horyzont generowania wystąpień, gdy brak `recurrence_until` —
// wystarczająco daleko, by nie trzeba było doń wracać przez dłuższy czas.
const DEFAULT_HORIZON_DAYS: Record<RecurrenceFreq, number> = {
  daily: 90,
  weekly: 365,
  monthly: 730,
}

function addInterval(date: Date, freq: RecurrenceFreq, interval: number): Date {
  const d = new Date(date)
  if (freq === 'daily') d.setDate(d.getDate() + interval)
  else if (freq === 'weekly') d.setDate(d.getDate() + interval * 7)
  else d.setMonth(d.getMonth() + interval)
  return d
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Daty kolejnych wystąpień zadania cyklicznego, licząc OD (i bez) `startDate` —
 * pierwsze wystąpienie to samo utworzone zadanie, tu generujemy tylko resztę.
 * Każde wystąpienie zostaje osobnym wierszem `tasks`, więc jego komentarze
 * i status liczą się niezależnie od pozostałych.
 */
export function generateOccurrenceDates(
  startDate: string,
  freq: RecurrenceFreq,
  interval: number,
  until: string | null,
): string[] {
  const safeInterval = Math.max(1, Math.floor(interval) || 1)
  const start = new Date(`${startDate}T00:00:00`)
  const horizon = until
    ? new Date(`${until}T00:00:00`)
    : addInterval(start, 'daily', DEFAULT_HORIZON_DAYS[freq])

  const dates: string[] = []
  let cursor = addInterval(start, freq, safeInterval)
  while (cursor <= horizon && dates.length < MAX_OCCURRENCES) {
    dates.push(toDateKey(cursor))
    cursor = addInterval(cursor, freq, safeInterval)
  }
  return dates
}
