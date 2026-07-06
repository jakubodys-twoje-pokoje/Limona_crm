// Best-effort parser for Polish free-text opening hours.
// Handles formats like: "Pn-Pt 9:00-16:00", "9-17", "Pn-Pt 8-16, Sb 10-13"
// Returns true if open now, false if closed, null if unparseable.

const DAY_NORM: Record<string, number> = {
  pn: 1, pon: 1, poniedzialek: 1,
  wt: 2, wto: 2, wtorek: 2,
  sr: 3, sro: 3, sroda: 3,
  cz: 4, czw: 4, czwartek: 4,
  pt: 5, pia: 5, piatek: 5,
  sb: 6, sob: 6, sobota: 6,
  nd: 0, ndz: 0, nie: 0, niedziela: 0,
}

function normalizeDay(s: string): number | null {
  const key = s.trim().toLowerCase()
    .replace(/ą/g, 'a').replace(/ę/g, 'e').replace(/ó/g, 'o')
    .replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z')
    .replace(/ń/g, 'n').replace(/ć/g, 'c').replace(/ł/g, 'l')
    .replace(/\./g, '')
  return DAY_NORM[key] ?? null
}

function parseMinutes(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2})(?:[:.h](\d{0,2}))?$/)
  if (!m) return null
  const h = parseInt(m[1])
  const min = m[2] ? parseInt(m[2].padEnd(2, '0')) : 0
  if (h > 24 || min > 59) return null
  return h * 60 + min
}

function daysInRange(start: number, end: number): number[] {
  const days: number[] = []
  let d = start
  for (let i = 0; i <= 7; i++) {
    days.push(d)
    if (d === end) break
    d = (d + 1) % 7
  }
  return days
}

export function isOpenNow(godziny: string | null | undefined): boolean | null {
  if (!godziny?.trim()) return null

  const now = new Date()
  const currentDay = now.getDay()
  const currentMin = now.getHours() * 60 + now.getMinutes()

  const segments = godziny.split(/[,;]/)

  for (const seg of segments) {
    // Find time range like "9:00-16:00" or "9-16"
    const timeM = seg.match(/(\d{1,2}[:.h]?\d{0,2})\s*[-–]\s*(\d{1,2}[:.h]?\d{0,2})/)
    if (!timeM) continue

    const start = parseMinutes(timeM[1])
    const end   = parseMinutes(timeM[2])
    if (start === null || end === null) continue

    // Day part is everything before the time range
    const dayPart = seg.slice(0, timeM.index).trim().replace(/[:\-–]?\s*$/, '')

    if (!dayPart) {
      if (currentMin >= start && currentMin < end) return true
      continue
    }

    const rangeM = dayPart.match(/^(\w+)\s*[-–]\s*(\w+)$/)
    if (rangeM) {
      const s = normalizeDay(rangeM[1])
      const e = normalizeDay(rangeM[2])
      if (s === null || e === null) {
        if (currentMin >= start && currentMin < end) return true
        continue
      }
      if (daysInRange(s, e).includes(currentDay) && currentMin >= start && currentMin < end) return true
    } else {
      const day = normalizeDay(dayPart)
      if (day === null) {
        if (currentMin >= start && currentMin < end) return true
      } else if (day === currentDay && currentMin >= start && currentMin < end) {
        return true
      }
    }
  }

  return false
}
