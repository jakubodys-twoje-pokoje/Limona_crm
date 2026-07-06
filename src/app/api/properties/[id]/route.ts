export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { geocodeAddress } from '@/lib/geocode'
import { getStageLabel } from '@/lib/stages'
import { formatStatusChangeComment } from '@/lib/status-comments'

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
  const statusComment: string | undefined = body.statusComment
  delete body.statusComment

  const { data: existing } = await supabase
    .from('properties')
    .select('status, deal_type')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Każda zmiana statusu wymaga komentarza uzasadniającego (dlaczego?)
  const statusChanging = typeof body.status === 'string' && body.status !== existing.status
  if (statusChanging && !statusComment?.trim()) {
    return NextResponse.json({ error: 'Zmiana statusu wymaga komentarza — uzasadnij, dlaczego' }, { status: 400 })
  }

  // Re-geokodowanie, gdy zmienił się adres
  let coordPatch = {}
  if (typeof body.location === 'string') {
    const coords = await geocodeAddress(body.location, null, null)
    if (coords) coordPatch = coords
  }

  const { data: property, error } = await supabase
    .from('properties')
    .update({ ...body, ...coordPatch })
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

  if (statusChanging && statusComment) {
    const dealType = body.deal_type ?? existing.deal_type
    await supabase.from('property_comments').insert({
      property_id: id,
      user_id: user.id,
      content: formatStatusChangeComment(getStageLabel(body.status, dealType), statusComment),
    })
  }

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
