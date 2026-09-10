export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import { canDeleteRecords } from '@/lib/deletion'
import { geocodeAddress } from '@/lib/geocode'
import { getStatusDluznikaLabel, getStatusInwestoraLabel } from '@/lib/stages'
import { formatStatusChangeComment } from '@/lib/status-comments'
import { notifyCardActivity } from '@/lib/notify'
import { formatPropertyAddress } from '@/lib/utils'
import { canAccessProperty, recordNotFound } from '@/lib/record-access'

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
  // Ten sam zakres, co na liście (patrz lib/record-access)
  if (!(await canAccessProperty(supabase, user, id))) return recordNotFound()

  return NextResponse.json(property)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  // Edytować można tylko to, co się widzi — ta sama reguła co przy odczycie
  if (!(await canAccessProperty(supabase, user, id))) return recordNotFound()

  const body = await req.json()
  const statusComment: string | undefined = body.statusComment
  delete body.statusComment

  const { data: existing } = await supabase
    .from('properties')
    .select('status_dluznika, status_inwestora')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Każda zmiana statusu (dłużnika lub inwestora) wymaga komentarza uzasadniającego
  const dluznikChanging = typeof body.status_dluznika === 'string' && body.status_dluznika !== existing.status_dluznika
  const inwestorChanging = typeof body.status_inwestora === 'string' && body.status_inwestora !== existing.status_inwestora
  const statusChanging = dluznikChanging || inwestorChanging
  if (statusChanging && !statusComment?.trim()) {
    return NextResponse.json({ error: 'Zmiana statusu wymaga komentarza — uzasadnij, dlaczego' }, { status: 400 })
  }

  // Archiwizacja: status „zrezygnował" wkłada nieruchomość do archiwum,
  // każda inna zmiana statusu dłużnika ją stamtąd przywraca.
  let archivePatch: { archived_at?: string | null } = {}
  if (dluznikChanging) {
    if (body.status_dluznika === 'zrezygnowal') archivePatch = { archived_at: new Date().toISOString() }
    else if (existing.status_dluznika === 'zrezygnowal') archivePatch = { archived_at: null }
  }

  // Re-geokodowanie, gdy zmienił się adres
  let coordPatch = {}
  if (typeof body.adres === 'string' || typeof body.miasto === 'string') {
    const { data: current } = await supabase.from('properties').select('adres, miasto').eq('id', id).maybeSingle()
    const adres = typeof body.adres === 'string' ? body.adres : current?.adres
    const miasto = typeof body.miasto === 'string' ? body.miasto : current?.miasto
    const coords = await geocodeAddress(adres, miasto ?? null, null)
    if (coords) coordPatch = coords
  }

  const { data: property, error } = await supabase
    .from('properties')
    .update({ ...body, ...coordPatch, ...archivePatch })
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
    const label = dluznikChanging ? getStatusDluznikaLabel(body.status_dluznika) : getStatusInwestoraLabel(body.status_inwestora)
    await supabase.from('property_comments').insert({
      property_id: id,
      user_id: user.id,
      content: formatStatusChangeComment(label, statusComment),
    })

    // Powiadom kierownictwo i osoby powiązane z nieruchomością o zmianie statusu
    await notifyCardActivity(supabase, {
      actorId: user.id,
      linkedUserIds: [property.assigned_to, property.created_by, ...(property.co_assignees ?? [])],
      type: 'card_change',
      title: `Nieruchomość: ${label}`,
      body: `${user.name} — ${formatPropertyAddress(property)}: ${statusComment}`,
      link: `/nieruchomosci/${id}`,
      referenceId: id,
    })
  }

  return NextResponse.json(property)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  // Usuwać wprost mogą tylko role zarządzające zespołem — zwykły użytkownik
  // zgłasza prośbę o usunięcie (POST /api/deletion-requests)
  if (!canDeleteRecords(user.role)) return forbidden()
  if (!(await canAccessProperty(supabase, user, id))) return recordNotFound()

  const { error } = await supabase.from('properties').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
