import type {
  ContactCategory, LeadTemperature, RejectionReason, TaskOutcome, TaskType,
} from '@/types/database'

// ---------------------------------------------------------------
// Polskie etykiety (jedno źródło dla UI i tekstu raportu)
// ---------------------------------------------------------------
export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  wizyta: 'Wizyta',
  telefon: 'Telefon',
  inne: 'Inne',
}

export const CONTACT_CATEGORY_LABELS: Record<ContactCategory, string> = {
  spoldzielnia: 'Spółdzielnia',
  wspolnota: 'Wspólnota',
  posrednik_finansowy: 'Pośrednik finansowy',
  posrednik_kredytowy: 'Pośrednik kredytowy',
  inny: 'Inny',
}

export const OUTCOME_LABELS: Record<TaskOutcome, string> = {
  zainteresowany: 'Zainteresowany',
  oczekuje_na_materialy: 'Oczekuje na materiały',
  niezainteresowany: 'Niezainteresowany',
  brak_kontaktu: 'Brak kontaktu',
}

export const REJECTION_REASON_LABELS: Record<RejectionReason, string> = {
  cena: 'Cena',
  timing: 'Timing',
  konkurencja: 'Ma konkurencję',
  brak_decyzyjnosci: 'Brak decyzyjności',
  inny: 'Inny',
}

export const LEAD_TEMPERATURE_LABELS: Record<LeadTemperature, string> = {
  goracy: 'Gorący',
  sredni: 'Średni',
  zimny: 'Zimny',
}

// Sekcje liczników w raporcie — kolejność jak we wzorze Patryka
export const REPORT_CATEGORIES: ContactCategory[] = [
  'spoldzielnia', 'wspolnota', 'posrednik_finansowy', 'posrednik_kredytowy',
]

export const REPORT_CATEGORY_HEADERS: Record<ContactCategory, string> = {
  spoldzielnia: 'SPÓŁDZIELNIE',
  wspolnota: 'WSPÓLNOTY',
  posrednik_finansowy: 'POŚREDNICY FINANSOWI',
  posrednik_kredytowy: 'POŚREDNICY KREDYTOWI',
  inny: 'INNE KONTAKTY',
}

// ---------------------------------------------------------------
// Kształt odpowiedzi GET /api/reports/daily
// ---------------------------------------------------------------
export interface ReportTask {
  id: string
  title: string
  task_type: TaskType | null
  contact_category: ContactCategory | null
  outcome: TaskOutcome | null
  rejection_reason: RejectionReason | null
  property: { id: string; location: string } | null
}

export interface CategoryCounters {
  total: number
  zainteresowany: number
  oczekuje_na_materialy: number
  niezainteresowany: number
  brak_kontaktu: number
}

export interface ReportProperty {
  id: string
  location: string
  lead_temperature: LeadTemperature | null
}

export interface DailyReportData {
  date: string
  userId: string
  userName: string
  doneTasks: ReportTask[]
  categories: Partial<Record<ContactCategory, CategoryCounters>>
  newProperties: ReportProperty[]
  planTomorrow: { id: string; title: string; property: { id: string; location: string } | null }[]
  note: { content: string; submitted_at: string | null }
}

// ---------------------------------------------------------------
// Zakres doby w strefie Europe/Warsaw (serwer działa w UTC)
// ---------------------------------------------------------------
function warsawOffset(probe: Date): string {
  const tz = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Warsaw',
    timeZoneName: 'longOffset',
  })
    .formatToParts(probe)
    .find(p => p.type === 'timeZoneName')?.value
  // "GMT+02:00" -> "+02:00"
  return tz && tz !== 'GMT' ? tz.replace('GMT', '') : '+01:00'
}

export function warsawDayRange(dateStr: string): { start: string; end: string } {
  const offset = warsawOffset(new Date(`${dateStr}T12:00:00Z`))
  const start = new Date(`${dateStr}T00:00:00${offset}`)
  const end = new Date(start.getTime() + 24 * 3600 * 1000)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function warsawToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date())
}

export function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------
// Czysty tekst raportu — układ 1:1 ze wzorem (przycisk „Kopiuj")
// ---------------------------------------------------------------
export function buildReportText(data: DailyReportData): string {
  const [y, m, d] = data.date.split('-')
  const lines: string[] = []

  lines.push(`RAPORT DZIENNY — ${d}.${m}.${y}`)
  lines.push(data.userName)
  lines.push('')

  lines.push('CEL DNIA — REALIZACJA')
  lines.push(data.note.content.trim() || '—')
  lines.push('')

  lines.push('CO UDAŁO SIĘ ZROBIĆ')
  if (data.doneTasks.length === 0) {
    lines.push('—')
  } else {
    for (const t of data.doneTasks) {
      const loc = t.property ? ` (${t.property.location})` : ''
      const outcome = t.outcome ? ` — ${OUTCOME_LABELS[t.outcome]}` : ''
      lines.push(`- ${t.title}${loc}${outcome}`)
    }
  }
  lines.push('')

  for (const cat of REPORT_CATEGORIES) {
    const c = data.categories[cat]
    lines.push(REPORT_CATEGORY_HEADERS[cat])
    lines.push(`Odwiedzono/kontakty: ${c?.total ?? 0}`)
    lines.push(`Zainteresowani: ${c?.zainteresowany ?? 0}`)
    lines.push(`Oczekują na materiały: ${c?.oczekuje_na_materialy ?? 0}`)
    lines.push(`Niezainteresowani: ${c?.niezainteresowany ?? 0}`)
    lines.push('')
  }

  lines.push('NOWE TEMATY')
  const byTemp = (t: LeadTemperature | null) => data.newProperties.filter(p => p.lead_temperature === t)
  const tempLine = (label: string, items: ReportProperty[]) =>
    `${label}: ${items.length ? items.map(p => p.location).join(', ') : '—'}`
  lines.push(tempLine('Gorące', byTemp('goracy')))
  lines.push(tempLine('Średnie', byTemp('sredni')))
  lines.push(tempLine('Zimne', byTemp('zimny')))
  const noTemp = byTemp(null)
  if (noTemp.length) lines.push(tempLine('Bez oceny', noTemp))
  lines.push('')

  lines.push('PLAN NA JUTRO')
  if (data.planTomorrow.length === 0) {
    lines.push('—')
  } else {
    for (const t of data.planTomorrow) {
      const loc = t.property ? ` (${t.property.location})` : ''
      lines.push(`- ${t.title}${loc}`)
    }
  }

  return lines.join('\n')
}
