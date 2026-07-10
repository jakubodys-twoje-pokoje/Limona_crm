export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import { warsawDayRange, warsawToday, shiftDate } from '@/lib/reports'
import type { CategoryCounters, DailyReportData, ReportTask, ReportProperty } from '@/lib/reports'
import { formatPropertyAddress } from '@/lib/utils'
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

  // Cudzy raport: tylko admin lub manager widzący usera w team_visibility
  let userName = user.name
  if (userId !== user.id) {
    if (user.role !== 'admin') {
      const { data: rule } = await supabase
        .from('team_visibility')
        .select('id')
        .eq('manager_id', user.id)
        .eq('member_id', userId)
        .maybeSingle()
      if (!rule) return forbidden()
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

  const [doneRes, newPropsRes, planRes, noteRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, task_type, contact_category, outcome, rejection_reason, property:properties!tasks_property_id_fkey(id,adres,kod_pocztowy,miasto)')
      .eq('status', 'done')
      .gte('completed_at', start)
      .lt('completed_at', end)
      .or(mine)
      .order('completed_at', { ascending: true }),
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
      .select('content, submitted_at')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle(),
  ])

  const firstError = doneRes.error || newPropsRes.error || planRes.error || noteRes.error
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 })

  const doneTasks = ((doneRes.data ?? []) as unknown as { property: RawPropertyRef | null; [k: string]: unknown }[]).map(withLocation) as unknown as ReportTask[]

  // Liczniki kategoria kontaktu × wynik (tylko zadania kontaktowe)
  const categories: Partial<Record<ContactCategory, CategoryCounters>> = {}
  for (const t of doneTasks) {
    if (!t.contact_category) continue
    const c = (categories[t.contact_category] ??= {
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
    doneTasks,
    categories,
    newProperties,
    planTomorrow: ((planRes.data ?? []) as unknown as { property: RawPropertyRef | null; [k: string]: unknown }[]).map(withLocation) as unknown as DailyReportData['planTomorrow'],
    note: {
      content: noteRes.data?.content ?? '',
      submitted_at: noteRes.data?.submitted_at ?? null,
    },
  }

  return NextResponse.json(data)
}
