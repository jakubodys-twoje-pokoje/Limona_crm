export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  // Admin sees all
  if (user.role === 'admin') {
    return NextResponse.json({ visibleIds: null })
  }

  // Fetch who this user manages
  const supabase = await createClient()
  const { data: rules, error } = await supabase
    .from('team_visibility')
    .select('member_id')
    .eq('manager_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const visibleIds = [user.id, ...(rules ?? []).map(r => r.member_id)]
  return NextResponse.json({ visibleIds })
}
