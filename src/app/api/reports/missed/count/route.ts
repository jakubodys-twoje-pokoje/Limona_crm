export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { warsawToday } from '@/lib/reports'

const MONTH_RE = /^\d{4}-\d{2}$/

/**
 * GET ?month=YYYY-MM — liczba potwierdzonych braków raportu per user
 * w danym miesiącu (do ewaluacji). Admin/manager widzi swój zasięg
 * (RLS), zwykły user tylko siebie.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const month = req.nextUrl.searchParams.get('month') || warsawToday().slice(0, 7)
  if (!MONTH_RE.test(month)) {
    return NextResponse.json({ error: 'Nieprawidłowy miesiąc (YYYY-MM)' }, { status: 400 })
  }

  const [y, m] = month.split('-').map(Number)
  const from = `${month}-01`
  const to = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`

  const { data, error } = await supabase
    .from('missed_report_acks')
    .select('user_id')
    .gte('report_date', from)
    .lt('report_date', to)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.user_id] = (counts[row.user_id] ?? 0) + 1
  }

  return NextResponse.json({ month, counts })
}
