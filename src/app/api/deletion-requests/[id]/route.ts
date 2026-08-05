export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import { canReviewDeletions, type DeletionEntityType } from '@/lib/deletion'

const ENTITY_TABLE: Record<DeletionEntityType, string> = {
  lead: 'leads',
  kontakt: 'kontakty',
  property: 'properties',
}

// Rozpatrzenie prośby: approve (usuwa rekord) / reject (odrzuca) — tylko centrala
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!canReviewDeletions(user.role)) return forbidden()
  const supabase = await createClient()
  const { id } = await params

  const { action, note } = await req.json()
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'Nieznana akcja' }, { status: 400 })
  }

  const { data: request } = await supabase
    .from('deletion_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (request.status !== 'pending') {
    return NextResponse.json({ error: 'Prośba została już rozpatrzona' }, { status: 409 })
  }

  // Zatwierdzenie = faktyczne usunięcie rekordu
  if (action === 'approve') {
    const table = ENTITY_TABLE[request.entity_type as DeletionEntityType]
    if (!table) return NextResponse.json({ error: 'Nieznany typ rekordu' }, { status: 400 })
    const { error: delError } = await supabase.from(table).delete().eq('id', request.entity_id)
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })
  }

  const { data: updated, error } = await supabase
    .from('deletion_requests')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_note: note?.trim() || null,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Powiadom zgłaszającego o decyzji
  if (request.requested_by && request.requested_by !== user.id) {
    const decision = action === 'approve' ? 'zaakceptowana — rekord usunięty' : 'odrzucona'
    await supabase.from('notifications').insert({
      user_id: request.requested_by,
      from_user_id: user.id,
      type: 'deletion_decision',
      title: `Prośba o usunięcie ${action === 'approve' ? 'zaakceptowana' : 'odrzucona'}`,
      body: `${request.entity_label ?? request.entity_type}: ${decision}${note?.trim() ? ` — ${note.trim().slice(0, 120)}` : ''}`,
      link: action === 'approve' ? null : '/usuniecia',
      reference_id: request.id,
    })
  }

  return NextResponse.json(updated)
}
