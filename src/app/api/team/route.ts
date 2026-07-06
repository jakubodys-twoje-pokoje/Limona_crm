export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import { canManageTeams } from '@/lib/roles'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('team_visibility')
    .select(`*,
      manager:profiles!team_visibility_manager_id_fkey(id,full_name,avatar_url,role),
      member:profiles!team_visibility_member_id_fkey(id,full_name,avatar_url,role)`)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!canManageTeams(user.role)) return forbidden()
  const supabase = await createClient()

  const { managerId, memberId } = await req.json()

  const { data: rule, error } = await supabase
    .from('team_visibility')
    .insert({ manager_id: managerId, member_id: memberId, created_by: user.id })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(rule, { status: 201 })
}
