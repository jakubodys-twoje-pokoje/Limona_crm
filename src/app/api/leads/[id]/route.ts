export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { LEAD_STATUS_LABELS, formatStatusChangeComment } from '@/lib/status-comments'
import type { LeadStatus } from '@/types/database'

const SELECT_WITH_RELATIONS = `*,
  assignee:profiles!leads_assigned_to_fkey(id,full_name,avatar_url),
  creator:profiles!leads_created_by_fkey(id,full_name,avatar_url)`

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const { data: lead } = await supabase
    .from('leads')
    .select(SELECT_WITH_RELATIONS)
    .eq('id', id)
    .maybeSingle()
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(lead)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const body = await req.json()
  const statusComment: string | undefined = body.statusComment

  const { data: existing } = await supabase
    .from('leads')
    .select('status')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Każda zmiana statusu wymaga komentarza uzasadniającego (dlaczego?)
  const statusChanging = typeof body.status === 'string' && body.status !== existing.status
  if (statusChanging && !statusComment?.trim()) {
    return NextResponse.json({ error: 'Zmiana statusu wymaga komentarza — uzasadnij, dlaczego' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  for (const f of ['name', 'phone', 'email', 'location', 'source', 'notes', 'status'] as const) {
    if (body[f] !== undefined) updates[f] = body[f]
  }
  if (body.assignedTo !== undefined) updates.assigned_to = body.assignedTo || null
  if (body.propertyId !== undefined) updates.property_id = body.propertyId || null

  const { data: lead, error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id)
    .select(SELECT_WITH_RELATIONS)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (statusChanging && statusComment) {
    await supabase.from('lead_comments').insert({
      lead_id: id,
      user_id: user.id,
      content: formatStatusChangeComment(LEAD_STATUS_LABELS[body.status as LeadStatus], statusComment),
    })
  }

  return NextResponse.json(lead)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
