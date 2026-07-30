export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import { warsawDayRange, warsawToday, shiftDate } from '@/lib/reports'
import type { CategoryCounters, DailyReportData, ReportDayTask, ReportProperty } from '@/lib/reports'
import { formatPropertyAddress } from '@/lib/utils'
import { canManageTeams } from '@/lib/roles'
import type { ContactCategory, TaskOutcome } from '@/types/database'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

interface RawPropertyRef { id: string; adres: string; kod_pocztowy: string | null; miasto: string | null }

function withLocation<T extends { property: RawPropertyRef | null }>(row: T): Omit<T, 'property'> & { property: { id: string; location: string } | null } {
  return { ...row, property: row.property ? { id: row.property.id, location: formatPropertyAddress(row.property) } : null }
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const { searchParams } = req.nextUrl
  const date = searchParams.get('date') || warsawToday()
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: 'Nieprawidłowa data (YYYY-MM-DD)' }, { status: 400 })
  }
  const userId = searchParams.get('userId') || user.id

  // Cudzy raport: admin/kierownik_centrali widzą wszystko, lider zespołu
  // tylko współczłonków swoich zespołów, zwykły user tylko siebie.
  let userName = user.name
  if (userId !== user.id) {
    if (!canManageTeams(user.role)) {
      const { data: leadRows } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .eq('is_lead', true)
      const teamIds = (leadRows ?? []).map(r => r.team_id)
      let sharesTeam = false
      if (teamIds.length) {
        const { data: rule } = await supabase
          .from('team_members')
          .select('id')
          .eq('user_id', userId)
          .in('team_id', teamIds)
          .maybeSingle()
        sharesTeam = !!rule
      }
      if (!sharesTeam) return forbidden()
    }
    const { data: target } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle()
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    userName = target.full_name
  }

  const { start, end } = warsawDayRange(date)
  const tomorrow = shiftDate(date, 1)
  const mine = `assigned_to.eq.${userId},and(assigned_to.is.null,created_by.eq.${userId})`
  const dayClause = `due_date.eq.${date},and(completed_at.gte.${start},completed_at.lt.${end})`

  const [dayTasksRes, newPropsRes, planRes, noteRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_time, realization_date, task_type, contact_category, outcome, rejection_reason, kontakt_id, property:properties!tasks_property_id_fkey(id,adres,kod_pocztowy,miasto), kontakt:kontakty!tasks_kontakt_id_fkey(id,nazwa,typ)')
      .or(mine)
      .or(dayClause)
      .order('due_time', { ascending: true, nullsFirst: false }),
    supabase
      .from('properties')
      .select('id, adres, kod_pocztowy, miasto')
      .gte('created_at', start)
      .lt('created_at', end)
      .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
      .order('created_at', { ascending: true }),
    supabase
      .from('tasks')
      .select('id, title, property:properties!tasks_property_id_fkey(id,adres,kod_pocztowy,miasto)')
      .eq('due_date', tomorrow)
      .neq('status', 'done')
      .or(mine)
      .order('created_at', { ascending: true }),
    supabase
      .from('daily_reports')
      .select('content, submitted_at, edited_at, task_notes')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle(),
  ])

  const firstError = dayTasksRes.error || newPropsRes.error || planRes.error || noteRes.error
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 })

  const taskNotes: Record<string, string> = noteRes.data?.task_notes ?? {}

  // Komentarze dodane do zadań dnia w obrębie doby — trafiają do raportu, żeby
  // nie trzeba było ich przepisywać ręcznie (komentarz z karty nieruchomości/
  // spółdzielni jest lustrzany do komentarza zadania — patrz POST /api/comments)
  const dayTaskIds = ((dayTasksRes.data ?? []) as unknown as { id: string }[]).map(t => t.id)
  const commentsByTask: Record<string, { author: string; content: string; created_at: string }[]> = {}
  if (dayTaskIds.length) {
    const { data: commentRows } = await supabase
      .from('task_comments')
      .select('task_id, content, created_at, user:profiles!task_comments_user_id_fkey(full_name)')
      .in('task_id', dayTaskIds)
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: true })
    for (const c of (commentRows ?? []) as unknown as { task_id: string; content: string; created_at: string; user: { full_name: string } | { full_name: string }[] | null }[]) {
      const u = Array.isArray(c.user) ? c.user[0] : c.user
      ;(commentsByTask[c.task_id] ??= []).push({ author: u?.full_name ?? 'Użytkownik', content: c.content, created_at: c.created_at })
    }
  }

  const dayTasks: ReportDayTask[] = ((dayTasksRes.data ?? []) as unknown as { id: string; property: RawPropertyRef | null; [k: string]: unknown }[])
    .map(withLocation)
    .map(t => ({ ...t, note: taskNotes[t.id as string] ?? '', comments: commentsByTask[t.id as string] ?? [] })) as unknown as ReportDayTask[]

  // Kategoria kontaktu do statystyki: wprost z zadania, a jeśli nie ustawiono —
  // wyprowadzona z typu powiązanego kontaktu (spółdzielnia/wspólnota). Dzięki
  // temu domknięte zadanie na karcie spółdzielni liczy się jako wykonane, nawet
  // gdy agent zaznaczył tylko typ i wynik, bez ręcznego wyboru kategorii.
  function categoryOf(t: ReportDayTask): ContactCategory | null {
    if (t.contact_category) return t.contact_category
    if (t.kontakt?.typ === 'spoldzielnia') return 'spoldzielnia'
    if (t.kontakt?.typ === 'wspolnota') return 'wspolnota'
    return null
  }

  // Liczniki kategoria kontaktu × wynik (tylko domknięte zadania kontaktowe)
  const categories: Partial<Record<ContactCategory, CategoryCounters>> = {}
  for (const t of dayTasks) {
    if (t.status !== 'done') continue
    const cat = categoryOf(t)
    if (!cat) continue
    const c = (categories[cat] ??= {
      total: 0, zainteresowany: 0, oczekuje_na_materialy: 0, niezainteresowany: 0, brak_kontaktu: 0,
    })
    c.total++
    if (t.outcome) c[t.outcome as TaskOutcome]++
  }

  const newProperties: ReportProperty[] = ((newPropsRes.data ?? []) as unknown as RawPropertyRef[])
    .map(p => ({ id: p.id, location: formatPropertyAddress(p) }))

  const data: DailyReportData = {
    date,
    userId,
    userName,
    dayTasks,
    categories,
    newProperties,
    planTomorrow: ((planRes.data ?? []) as unknown as { property: RawPropertyRef | null; [k: string]: unknown }[]).map(withLocation) as unknown as DailyReportData['planTomorrow'],
    note: {
      content: noteRes.data?.content ?? '',
      submitted_at: noteRes.data?.submitted_at ?? null,
      edited_at: noteRes.data?.edited_at ?? null,
    },
  }

  return NextResponse.json(data)
}
