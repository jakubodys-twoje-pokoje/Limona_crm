// Generowanie feedu ICS (iCalendar) z zadań — jednokierunkowa subskrypcja
// kalendarza (CRM → Google/Apple/Outlook), bez OAuth. Zadania z terminem
// stają się wydarzeniami; z godziną → godzinowe (30 min), bez godziny → całodniowe.

export interface IcsTask {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  due_date: string           // YYYY-MM-DD
  due_time: string | null    // HH:MM[:SS]
  property?: { adres: string; kod_pocztowy: string | null; miasto: string | null } | null
  kontakt?: { nazwa: string } | null
  lead?: { name: string } | null
}

const STATUS_PL: Record<string, string> = {
  todo: 'Do zrobienia', in_progress: 'W trakcie', done: 'Zrobione', blocked: 'Zablokowane',
}
const PRIORITY_PL: Record<string, string> = {
  low: 'Niski', medium: 'Średni', high: 'Wysoki', urgent: 'Pilny',
}

// Statyczna definicja strefy — Google/Apple honorują TZID z VTIMEZONE
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Warsaw',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
]

function escapeText(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

// Zawijanie długich linii do 75 oktetów (RFC 5545) — kolejne z wcięciem spacją
function fold(line: string): string {
  if (line.length <= 74) return line
  const out: string[] = []
  let s = line
  while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74) }
  out.push(s)
  return out.join('\r\n')
}

function pad(n: number): string { return String(n).padStart(2, '0') }

function stampUTC(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

// Traktujemy komponenty ściany zegara jako „UTC", żeby arytmetyka (+30 min,
// +1 dzień) poprawnie przewijała godziny/dni; sformatujemy z powrotem lokalnie.
function localParts(date: string, time: string): { y: number; mo: number; d: number; h: number; mi: number } {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  return { y, mo, d, h, mi }
}

function propertyLabel(p: NonNullable<IcsTask['property']>): string {
  return [p.adres, [p.kod_pocztowy, p.miasto].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

function eventFor(t: IcsTask, appUrl: string): string[] {
  const lines: string[] = ['BEGIN:VEVENT', `UID:${t.id}@limona-crm`, `DTSTAMP:${stampUTC(new Date())}`]

  if (t.due_time) {
    const { y, mo, d, h, mi } = localParts(t.due_date, t.due_time.slice(0, 5))
    const start = new Date(Date.UTC(y, mo - 1, d, h, mi))
    const end = new Date(start.getTime() + 30 * 60000)
    const fmt = (x: Date) => `${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}T${pad(x.getUTCHours())}${pad(x.getUTCMinutes())}00`
    lines.push(`DTSTART;TZID=Europe/Warsaw:${fmt(start)}`)
    lines.push(`DTEND;TZID=Europe/Warsaw:${fmt(end)}`)
  } else {
    const [y, mo, d] = t.due_date.split('-').map(Number)
    const next = new Date(Date.UTC(y, mo - 1, d + 1))
    const fmtDate = (yy: number, mm: number, dd: number) => `${yy}${pad(mm)}${pad(dd)}`
    lines.push(`DTSTART;VALUE=DATE:${fmtDate(y, mo, d)}`)
    lines.push(`DTEND;VALUE=DATE:${fmtDate(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate())}`)
  }

  const done = t.status === 'done'
  lines.push(`SUMMARY:${escapeText((done ? '✓ ' : '') + t.title)}`)

  const linked = t.property ? propertyLabel(t.property) : t.kontakt?.nazwa || t.lead?.name || null
  const descParts: string[] = []
  descParts.push(`Status: ${STATUS_PL[t.status] ?? t.status} · Priorytet: ${PRIORITY_PL[t.priority] ?? t.priority}`)
  if (linked) descParts.push(`Powiązanie: ${linked}`)
  if (t.description?.trim()) descParts.push(t.description.trim())
  descParts.push(`Limona CRM — ${appUrl}/zadania`)
  lines.push(`DESCRIPTION:${escapeText(descParts.join('\n'))}`)

  if (t.property) lines.push(`LOCATION:${escapeText(propertyLabel(t.property))}`)
  lines.push(done ? 'STATUS:COMPLETED' : 'STATUS:CONFIRMED')
  lines.push('END:VEVENT')
  return lines
}

export function buildIcs(tasks: IcsTask[], calName: string, appUrl: string): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Limona CRM//Zadania//PL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calName)}`,
    'X-WR-TIMEZONE:Europe/Warsaw',
    ...VTIMEZONE,
  ]
  for (const t of tasks) if (t.due_date) lines.push(...eventFor(t, appUrl))
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
