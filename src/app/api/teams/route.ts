export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import { canManageTeams } from '@/lib/roles'

const SELECT_WITH_MEMBERS = `*,
  members:team_members(id,team_id,user_id,is_lead,created_at,profile:profiles!team_members_user_id_fkey(id,full_name,avatar_url,role))`

export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('teams')
    .select(SELECT_WITH_MEMBERS)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!canManageTeams(user.role)) return forbidden()
  const supabase = await createClient()

  const { name, description, memberIds, leadIds } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nazwa zespołu jest wymagana' }, { status: 400 })

  const { data: team, error } = await supabase
    .from('teams')
    .insert({ name: name.trim(), description: description?.trim() || null, created_by: user.id })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids: string[] = Array.isArray(memberIds) ? memberIds : []
  const leads = new Set<string>(Array.isArray(leadIds) ? leadIds : [])
  if (ids.length) {
    const { error: membersError } = await supabase
      .from('team_members')
      .insert(ids.map(userId => ({ team_id: team.id, user_id: userId, is_lead: leads.has(userId) })))
    if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 })
  }

  const { data: full } = await supabase.from('teams').select(SELECT_WITH_MEMBERS).eq('id', team.id).single()
  return NextResponse.json(full ?? team, { status: 201 })
}
