export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { canReviewDeletions } from '@/lib/deletion'

// Liczba oczekujących próśb — do plakietki w menu (tylko centrala)
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!canReviewDeletions(user.role)) return NextResponse.json({ count: 0 })
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('deletion_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: count ?? 0 })
}
