export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { canSeeAllTeams } from '@/lib/roles'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  // Admin, manager i kierownik centrali widzą wszystkich (ewaluacja org-wide)
  if (canSeeAllTeams(user.role)) {
    return NextResponse.json({ visibleIds: null })
  }

  // W przeciwnym razie: widzi siebie + współczłonków każdego zespołu, gdzie
  // jest liderem (is_lead) — niezależnie od formalnej roli konta.
  const supabase = await createClient()
  const { data: leadRows, error: leadError } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)
    .eq('is_lead', true)
  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 })

  const teamIds = (leadRows ?? []).map(r => r.team_id)
  let memberIds: string[] = []
  if (teamIds.length) {
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('user_id')
      .in('team_id', teamIds)
    if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 })
    memberIds = (members ?? []).map(m => m.user_id)
  }

  const visibleIds = Array.from(new Set([user.id, ...memberIds]))
  return NextResponse.json({ visibleIds })
}
