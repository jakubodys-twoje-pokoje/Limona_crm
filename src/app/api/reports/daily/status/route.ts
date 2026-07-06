export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { warsawToday } from '@/lib/reports'

// Lekki status pod przycisk CTA — czy dzisiejszy raport już przesłany
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const today = warsawToday()
  const { data } = await supabase
    .from('daily_reports')
    .select('submitted_at')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle()

  return NextResponse.json({ date: today, submitted: !!data?.submitted_at })
}
