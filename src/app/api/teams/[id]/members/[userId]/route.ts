export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import { canManageTeams } from '@/lib/roles'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!canManageTeams(user.role)) return forbidden()
  const supabase = await createClient()
  const { id, userId } = await params

  const { isLead } = await req.json()
  const { error } = await supabase
    .from('team_members')
    .update({ is_lead: !!isLead })
    .eq('team_id', id)
    .eq('user_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!canManageTeams(user.role)) return forbidden()
  const supabase = await createClient()
  const { id, userId } = await params

  const { error } = await supabase.from('team_members').delete().eq('team_id', id).eq('user_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
