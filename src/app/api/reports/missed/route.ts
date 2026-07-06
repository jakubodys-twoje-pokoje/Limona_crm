export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { warsawToday, shiftDate, warsawDayRange } from '@/lib/reports'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * GET — czy pokazać popup o braku wczorajszego raportu?
 * missed = wczoraj bez submitted_at, bez potwierdzenia i konto
 * istniało już wczoraj.
 */
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const yesterday = shiftDate(warsawToday(), -1)

  const [reportRes, ackRes, profileRes] = await Promise.all([
    supabase
      .from('daily_reports')
      .select('submitted_at')
      .eq('user_id', user.id)
      .eq('date', yesterday)
      .maybeSingle(),
    supabase
      .from('missed_report_acks')
      .select('id')
      .eq('user_id', user.id)
      .eq('report_date', yesterday)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('created_at')
      .eq('id', user.id)
      .single(),
  ])

  if (reportRes.data?.submitted_at || ackRes.data) {
    return NextResponse.json({ missed: false })
  }

  // Nowe konto — nie karzemy za dzień sprzed rejestracji
  const { end: yesterdayEnd } = warsawDayRange(yesterday)
  if (profileRes.data && profileRes.data.created_at >= yesterdayEnd) {
    return NextResponse.json({ missed: false })
  }

  return NextResponse.json({ missed: true, date: yesterday })
}

/**
 * POST — potwierdzenie „mam świadomość braku raportu".
 * Zapis liczy się do ewaluacji (suma per miesiąc).
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const body = await req.json().catch(() => ({}))
  const date = body.date
  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: 'Nieprawidłowa data (YYYY-MM-DD)' }, { status: 400 })
  }

  const { error } = await supabase
    .from('missed_report_acks')
    .upsert(
      { user_id: user.id, report_date: date },
      { onConflict: 'user_id,report_date', ignoreDuplicates: true }
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
