export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import { warsawDayRange, warsawToday } from '@/lib/reports'
import { canManageTeams } from '@/lib/roles'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Roster raportów dziennych dla panelu przeglądania — admin/kierownik_centrali,
// org-wide (nie tylko własny zespół).
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!canManageTeams(user.role)) return forbidden()
  const supabase = await createClient()

  const date = req.nextUrl.searchParams.get('date') || warsawToday()
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: 'Nieprawidłowa data (YYYY-MM-DD)' }, { status: 400 })
  }
  const { start, end } = warsawDayRange(date)

  const [profilesRes, reportsRes, tasksRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, avatar_url').eq('role', 'user').order('full_name', { ascending: true }),
    supabase.from('daily_reports').select('user_id, content, submitted_at').eq('date', date),
    supabase
      .from('tasks')
      .select('assigned_to, created_by, status')
      .or(`due_date.eq.${date},and(completed_at.gte.${start},completed_at.lt.${end})`),
  ])

  const firstError = profilesRes.error || reportsRes.error || tasksRes.error
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 })

  const reportByUser = new Map((reportsRes.data ?? []).map(r => [r.user_id, r]))
  const counts: Record<string, { total: number; done: number }> = {}
  for (const t of tasksRes.data ?? []) {
    const uid = t.assigned_to || t.created_by
    if (!uid) continue
    const c = (counts[uid] ??= { total: 0, done: 0 })
    c.total++
    if (t.status === 'done') c.done++
  }

  const rows = (profilesRes.data ?? []).map(p => {
    const report = reportByUser.get(p.id)
    return {
      id: p.id,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      submitted: !!report?.submitted_at,
      submitted_at: report?.submitted_at ?? null,
      hasDraft: !!report?.content?.trim() && !report?.submitted_at,
      taskCounts: counts[p.id] ?? { total: 0, done: 0 },
    }
  })

  return NextResponse.json({ date, rows })
}
