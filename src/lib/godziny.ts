import { WEEK_DAYS, WEEK_DAY_SHORT } from '@/types/database'
import type { WeeklyHours } from '@/types/database'

function parseMinutes(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2})(?:[:.h](\d{0,2}))?$/)
  if (!m) return null
  const h = parseInt(m[1])
  const min = m[2] ? parseInt(m[2].padEnd(2, '0')) : 0
  if (h > 24 || min > 59) return null
  return h * 60 + min
}

// JS getDay(): 0=niedziela..6=sobota — mapujemy na WEEK_DAYS (poniedziałek pierwszy)
const JS_DAY_TO_WEEK_DAY = [
  WEEK_DAYS[6], // 0 niedziela
  WEEK_DAYS[0], // 1 poniedziałek
  WEEK_DAYS[1], // 2 wtorek
  WEEK_DAYS[2], // 3 środa
  WEEK_DAYS[3], // 4 czwartek
  WEEK_DAYS[4], // 5 piątek
  WEEK_DAYS[5], // 6 sobota
]

export function hasAnyHours(godziny: WeeklyHours | null | undefined): boolean {
  if (!godziny) return false
  return WEEK_DAYS.some(d => godziny[d]?.trim())
}

/** Czy punkt jest otwarty o wskazanym momencie (dowolny dzień/godzina, np. szacowany przyjazd w objeździe). */
export function isOpenAt(godziny: WeeklyHours | null | undefined, at: Date): boolean | null {
  if (!hasAnyHours(godziny)) return null

  const day = JS_DAY_TO_WEEK_DAY[at.getDay()]
  const range = godziny?.[day]
  if (!range?.trim()) return false

  const m = range.match(/(\d{1,2}[:.h]?\d{0,2})\s*[-–]\s*(\d{1,2}[:.h]?\d{0,2})/)
  if (!m) return null

  const start = parseMinutes(m[1])
  const end = parseMinutes(m[2])
  if (start === null || end === null) return null

  const mins = at.getHours() * 60 + at.getMinutes()
  return mins >= start && mins < end
}

export function isOpenNow(godziny: WeeklyHours | null | undefined): boolean | null {
  return isOpenAt(godziny, new Date())
}

export function formatWeeklyHours(godziny: WeeklyHours | null | undefined): string {
  if (!hasAnyHours(godziny)) return ''
  return WEEK_DAYS
    .filter(d => godziny?.[d]?.trim())
    .map(d => `${WEEK_DAY_SHORT[d]} ${godziny![d]}`)
    .join(', ')
}
