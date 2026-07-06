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

  const submitted_at = new Date().toISOString()
  const { error } = await supabase
    .from('daily_reports')
    .upsert(
      { user_id: user.id, date, submitted_at },
      { onConflict: 'user_id,date' }
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, submitted_at })
}
