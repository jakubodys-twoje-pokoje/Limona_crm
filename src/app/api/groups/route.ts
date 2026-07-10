export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { canManageTeams } from '@/lib/roles'

interface GroupInfo { id: string; name: string; memberCount: number; role: string }

// GET /api/groups — zespoły (teams), do których należy user; admin/kierownik
// centrali widzą też pozostałe zespoły (nadzór/ewaluacja).
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const { data: teams, error } = await supabase
    .from('teams')
    .select('id, name, members:team_members(user_id, is_lead)')
    .order('name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const groups: GroupInfo[] = []
  const orgWide = canManageTeams(user.role)

  for (const t of teams ?? []) {
    const members = (t.members ?? []) as { user_id: string; is_lead: boolean }[]
    const mine = members.find(m => m.user_id === user.id)
    if (!mine && !orgWide) continue
    groups.push({
      id: t.id,
      name: t.name,
      memberCount: members.length,
      role: mine ? (mine.is_lead ? 'lead' : 'member') : 'obserwator',
    })
  }

  return NextResponse.json(groups)
}
