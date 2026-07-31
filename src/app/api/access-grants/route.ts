export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import { canManageTeams } from '@/lib/roles'
import { ACCESS_SCOPES } from '@/lib/access'

const SELECT = `id, grantee_id, scope, target_user_id, created_at,
  grantee:profiles!access_grants_grantee_id_fkey(id,full_name,avatar_url),
  target:profiles!access_grants_target_user_id_fkey(id,full_name,avatar_url)`

// GET — lista grantów (opcjonalnie ?granteeId=). Tylko admin/kierownik centrali.
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!canManageTeams(user.role)) return forbidden()
  const supabase = await createClient()

  const granteeId = req.nextUrl.searchParams.get('granteeId')
  let query = supabase.from('access_grants').select(SELECT).order('created_at', { ascending: false })
  if (granteeId) query = query.eq('grantee_id', granteeId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — nadaj grant { granteeId, scope, targetUserId? }
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!canManageTeams(user.role)) return forbidden()
  const supabase = await createClient()

  const body = await req.json().catch(() => ({}))
  const granteeId: string | undefined = body.granteeId
  const scope: string | undefined = body.scope
  const targetUserId: string | null = body.targetUserId || null

  if (!granteeId || !scope) return NextResponse.json({ error: 'Brak granteeId lub scope' }, { status: 400 })
  if (!ACCESS_SCOPES.includes(scope as never)) return NextResponse.json({ error: 'Nieznana kategoria' }, { status: 400 })
  if (targetUserId && targetUserId === granteeId) {
    return NextResponse.json({ error: 'Własne rekordy user widzi bez grantu' }, { status: 400 })
  }

  // „Sprawdź i wstaw" — unikamy onConflict na indeksie z coalesce (null target)
  let dupQuery = supabase.from('access_grants').select('id')
    .eq('grantee_id', granteeId).eq('scope', scope)
  dupQuery = targetUserId ? dupQuery.eq('target_user_id', targetUserId) : dupQuery.is('target_user_id', null)
  const { data: existing } = await dupQuery.maybeSingle()
  if (existing) {
    const { data } = await supabase.from('access_grants').select(SELECT).eq('id', existing.id).maybeSingle()
    return NextResponse.json(data ?? { ok: true }, { status: 200 })
  }

  const { data, error } = await supabase
    .from('access_grants')
    .insert({ grantee_id: granteeId, scope, target_user_id: targetUserId, created_by: user.id })
    .select(SELECT)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
