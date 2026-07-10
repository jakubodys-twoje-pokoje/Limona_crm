export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import { canManageTeams } from '@/lib/roles'

// Dodawanie masowe — jednym zapytaniem można dorzucić kilku członków naraz
// (multi-select po stronie UI), zamiast sztywnego "jeden na raz".
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!canManageTeams(user.role)) return forbidden()
  const supabase = await createClient()
  const { id } = await params

  const { userIds, isLead } = await req.json()
  const ids: string[] = Array.isArray(userIds) ? userIds : []
  if (!ids.length) return NextResponse.json({ error: 'userIds required' }, { status: 400 })

  const { error } = await supabase
    .from('team_members')
    .upsert(
      ids.map(userId => ({ team_id: id, user_id: userId, is_lead: !!isLead })),
      { onConflict: 'team_id,user_id', ignoreDuplicates: true }
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true }, { status: 201 })
}
