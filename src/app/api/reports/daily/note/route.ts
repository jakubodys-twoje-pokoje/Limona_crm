export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { warsawToday } from '@/lib/reports'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Autosave spostrzeżeń — upsert własnej notatki, bez ruszania submitted_at
export async function PUT(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const body = await req.json()
  const date = body.date || warsawToday()
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: 'Nieprawidłowa data (YYYY-MM-DD)' }, { status: 400 })
  }
  // Okno edycji: tylko raport bieżącego dnia — po północy raport zamyka się na stałe
  if (date !== warsawToday()) {
    return NextResponse.json({ error: 'Raport można edytować tylko do północy dnia, którego dotyczy' }, { status: 400 })
  }
  const content = typeof body.content === 'string' ? body.content : ''
  const task_notes = body.task_notes && typeof body.task_notes === 'object' ? body.task_notes : {}

  // Zmiana treści po przesłaniu = raport edytowany (submitted_at zostaje pierwotne)
  const { data: existing } = await supabase
    .from('daily_reports')
    .select('submitted_at')
    .eq('user_id', user.id)
    .eq('date', date)
    .maybeSingle()
  const editStamp = existing?.submitted_at ? { edited_at: new Date().toISOString() } : {}

  const { error } = await supabase
    .from('daily_reports')
    .upsert(
      { user_id: user.id, date, content, task_notes, ...editStamp },
      { onConflict: 'user_id,date' }
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
