export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

interface GroupInfo { id: string; name: string; memberCount: number; role: string }

// GET /api/groups — grupy (zespoły z team_visibility), do których należy user
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const groups: GroupInfo[] = []

  const countMembers = async (managerId: string) => {
    const { count } = await supabase
      .from('team_visibility')
      .select('id', { count: 'exact', head: true })
      .eq('manager_id', managerId)
    return (count ?? 0) + 1
  }

  // Grupa, której jestem menedżerem
  if (user.role === 'admin' || user.role === 'manager') {
    const { data: managed } = await supabase
      .from('team_visibility')
      .select('id')
      .eq('manager_id', user.id)
    if (managed && managed.length > 0) {
      groups.push({ id: user.id, name: `Zespół ${user.name}`, memberCount: managed.length + 1, role: 'manager' })
    }
  }

  // Grupy, w których jestem członkiem
  const { data: membership } = await supabase
    .from('team_visibility')
    .select('manager_id, manager:profiles!team_visibility_manager_id_fkey(id,full_name)')
    .eq('member_id', user.id)

  for (const tv of membership ?? []) {
    if (groups.find(g => g.id === tv.manager_id)) continue
    const manager = tv.manager as unknown as { full_name: string } | null
    groups.push({
      id: tv.manager_id,
      name: `Zespół ${manager?.full_name ?? ''}`,
      memberCount: await countMembers(tv.manager_id),
      role: 'member',
    })
  }

  // Admin i kierownik centrali widzą wszystkie zespoły (nadzór/ewaluacja)
  if (user.role === 'admin' || user.role === 'kierownik_centrali') {
    const { data: allRules } = await supabase
      .from('team_visibility')
      .select('manager_id, manager:profiles!team_visibility_manager_id_fkey(id,full_name)')
      .neq('manager_id', user.id)
    for (const tv of allRules ?? []) {
      if (groups.find(g => g.id === tv.manager_id)) continue
      const manager = tv.manager as unknown as { full_name: string } | null
      groups.push({
        id: tv.manager_id,
        name: `Zespół ${manager?.full_name ?? ''}`,
        memberCount: await countMembers(tv.manager_id),
        role: 'member',
      })
    }
  }

  return NextResponse.json(groups)
}
