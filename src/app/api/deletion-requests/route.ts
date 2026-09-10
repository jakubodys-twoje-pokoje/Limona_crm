export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import { canAccessEntity, recordNotFound } from '@/lib/record-access'
import { canReviewDeletions, type DeletionEntityType } from '@/lib/deletion'

const SELECT_WITH_USERS = `*,
  requester:profiles!deletion_requests_requested_by_fkey(id,full_name,avatar_url),
  reviewer:profiles!deletion_requests_reviewed_by_fkey(id,full_name,avatar_url)`

// Etykieta rekordu do zapamiętania — czytelna nawet po usunięciu
const ENTITY_LABEL: Record<DeletionEntityType, { table: string; columns: string; format: (r: Record<string, unknown>) => string }> = {
  lead: { table: 'leads', columns: 'name', format: r => String(r.name ?? 'Lead') },
  kontakt: { table: 'kontakty', columns: 'nazwa', format: r => String(r.nazwa ?? 'Kontakt') },
  property: {
    table: 'properties',
    columns: 'adres, miasto',
    format: r => [r.adres, r.miasto].filter(Boolean).join(', ') || 'Nieruchomość',
  },
}

// Lista zgłoszeń — centrala widzi wszystko; zwykły user tylko własne (RLS)
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const status = req.nextUrl.searchParams.get('status')
  let query = supabase.from('deletion_requests').select(SELECT_WITH_USERS).order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Zgłoszenie prośby o usunięcie — każdy zalogowany, we własnym imieniu
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const { entity_type, entity_id, reason } = await req.json()
  if (!entity_type || !entity_id || !reason?.trim()) {
    return NextResponse.json({ error: 'Podaj rekord i powód usunięcia' }, { status: 400 })
  }
  if (!(entity_type in ENTITY_LABEL)) {
    return NextResponse.json({ error: 'Nieznany typ rekordu' }, { status: 400 })
  }
  // Zgłosić do usunięcia można tylko rekord, który się widzi — inaczej sama
  // prośba zwracałaby etykietę (adres/nazwę) cudzej karty.
  if (!(await canAccessEntity(supabase, user, entity_type, entity_id))) return recordNotFound()

  // Nie dubluj otwartej prośby dla tego samego rekordu
  const { data: existing } = await supabase
    .from('deletion_requests')
    .select('id')
    .eq('entity_type', entity_type)
    .eq('entity_id', entity_id)
    .eq('status', 'pending')
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'Ten rekord ma już otwartą prośbę o usunięcie' }, { status: 409 })
  }

  // Zapamiętaj czytelną etykietę rekordu
  const meta = ENTITY_LABEL[entity_type as DeletionEntityType]
  const { data: entity } = await supabase.from(meta.table).select(meta.columns).eq('id', entity_id).maybeSingle()
  const entity_label = entity ? meta.format(entity as unknown as Record<string, unknown>) : null

  const { data: request, error } = await supabase
    .from('deletion_requests')
    .insert({ entity_type, entity_id, entity_label, reason: reason.trim(), requested_by: user.id })
    .select(SELECT_WITH_USERS)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Powiadom centralę (admin + kierownik centrali)
  const { data: reviewers } = await supabase.from('profiles').select('id, role')
  const centralaIds = (reviewers ?? []).filter(r => canReviewDeletions(r.role as string)).map(r => r.id as string)
  const rows = centralaIds.filter(id => id !== user.id).map(id => ({
    user_id: id,
    from_user_id: user.id,
    type: 'deletion_request',
    title: 'Prośba o usunięcie',
    body: `${user.name} prosi o usunięcie: ${entity_label ?? entity_type} — ${reason.trim().slice(0, 120)}`,
    link: '/usuniecia',
    reference_id: request.id,
  }))
  if (rows.length) await supabase.from('notifications').insert(rows)

  return NextResponse.json(request, { status: 201 })
}
