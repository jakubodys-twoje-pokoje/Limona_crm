export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

const SELECT_WITH_RELATIONS = `*,
  creator:profiles!properties_created_by_fkey(id,full_name,avatar_url),
  assignee:profiles!properties_assigned_to_fkey(id,full_name,avatar_url)`

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const { data: property } = await supabase
    .from('properties')
    .select(SELECT_WITH_RELATIONS)
    .eq('id', id)
    .maybeSingle()

  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(property)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const body = await req.json()
  const { data: property, error } = await supabase
    .from('properties')
    .update(body)
    .eq('id', id)
    .select(SELECT_WITH_RELATIONS)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_log').insert({
    property_id: id,
    user_id: user.id,
    action: 'updated',
    details: body,
  })

  return NextResponse.json(property)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const { error } = await supabase.from('properties').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
