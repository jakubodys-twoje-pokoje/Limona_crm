export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { warsawToday } from '@/lib/reports'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// „Prześlij raport" — stempluje submitted_at na własnym raporcie dnia
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const body = await req.json().catch(() => ({}))
  const date = body.date || warsawToday()
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: 'Nieprawidłowa data (YYYY-MM-DD)' }, { status: 400 })
  }
  // Okno edycji: raport da się przesłać/nadpisać tylko do północy tego dnia
  if (date !== warsawToday()) {
    return NextResponse.json({ error: 'Raport można przesłać lub nadpisać tylko do północy dnia, którego dotyczy' }, { status: 400 })
  }

  const now = new Date().toISOString()

  // Ponowne przesłanie = nadpisanie: submitted_at zostaje pierwotne (widać,
  // o której raport wysłano), edited_at znaczy raport jako zmieniony.
  const { data: existing } = await supabase
    .from('daily_reports')
    .select('submitted_at')
    .eq('user_id', user.id)
    .eq('date', date)
    .maybeSingle()

  const payload: Record<string, string> = { user_id: user.id, date }
  if (existing?.submitted_at) payload.edited_at = now
  else payload.submitted_at = now

  const { error } = await supabase
    .from('daily_reports')
    .upsert(payload, { onConflict: 'user_id,date' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    submitted_at: existing?.submitted_at ?? now,
    edited_at: existing?.submitted_at ? now : null,
  })
}
