export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import { LEAD_STATUS_LABELS, formatStatusChangeComment } from '@/lib/status-comments'
import { validateLeadTransition } from '@/lib/lead-rules'
import { canSeeAllTeams } from '@/lib/roles'
import { geocodeAddress } from '@/lib/geocode'
import { notifyCardActivity } from '@/lib/notify'
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
    .select('status, assigned_to')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Konwertowany lead jest zamrożony — jego historia to dokument
  if (existing.status === 'converted') {
    return NextResponse.json({ error: 'Lead po konwersji jest tylko do odczytu' }, { status: 409 })
  }

  // Zmiana statusu: dozwolone przejście + obowiązkowy komentarz "dlaczego"
  const statusChanging = typeof body.status === 'string' && body.status !== existing.status
  if (statusChanging) {
    const transitionError = validateLeadTransition(existing.status as LeadStatus, body.status as LeadStatus)
    if (transitionError) return NextResponse.json({ error: transitionError }, { status: 400 })
    if (!statusComment?.trim()) {
      return NextResponse.json({ error: 'Zmiana statusu wymaga komentarza — uzasadnij, dlaczego' }, { status: 400 })
    }
  }

  // Przepięcie leada na innego agenta — tylko role zarządzające zespołem
  if (body.assignedTo !== undefined && body.assignedTo !== existing.assigned_to && !canSeeAllTeams(user.role)) {
    return forbidden()
  }

  const updates: Record<string, unknown> = {}
  for (const f of ['name', 'phone', 'email', 'location', 'source', 'notes', 'status', 'temperature'] as const) {
    if (body[f] !== undefined) updates[f] = body[f]
  }
  if (body.nextContactAt !== undefined) updates.next_contact_at = body.nextContactAt || null
  if (body.assignedTo !== undefined) updates.assigned_to = body.assignedTo || null

  // Re-geokodowanie przy zmianie lokalizacji (edycja starego leada też
  // dorabia mu współrzędne na mapę)
  if (typeof body.location === 'string' && body.location.trim()) {
    const coords = await geocodeAddress(body.location, null, null)
    if (coords) Object.assign(updates, coords)
  }

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

    // Powiadom kierownictwo i osoby powiązane z leadem o zmianie statusu
    await notifyCardActivity(supabase, {
      actorId: user.id,
      linkedUserIds: [lead.assigned_to, lead.created_by],
      type: 'card_change',
      title: `Lead: ${LEAD_STATUS_LABELS[body.status as LeadStatus]}`,
      body: `${user.name} — ${lead.name}: ${statusComment}`,
      link: '/leady',
      referenceId: id,
    })
  }

  return NextResponse.json(lead)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  // Usuwać może właściciel (przypisany/twórca) oraz role zarządzające zespołem
  if (!canSeeAllTeams(user.role)) {
    const { data: existing } = await supabase
      .from('leads')
      .select('assigned_to, created_by')
      .eq('id', id)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.assigned_to !== user.id && existing.created_by !== user.id) return forbidden()
  }

  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
