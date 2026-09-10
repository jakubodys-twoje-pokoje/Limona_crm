export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import { geocodeAddress } from '@/lib/geocode'
import { formatFlagChangeComment } from '@/lib/status-comments'
import { canManageTeams } from '@/lib/roles'
import { canDeleteRecords } from '@/lib/deletion'
import { userCanSeeInvestors, getUserGrants } from '@/lib/access'
import { getVisibleUserIds } from '@/lib/visibility'

const SELECT_WITH_RELATIONS = `*,
  creator:profiles!kontakty_created_by_fkey(id,full_name,avatar_url),
  assignee:profiles!kontakty_assigned_to_fkey(id,full_name,avatar_url),
  komentarze:kontakt_komentarze(*, user:profiles!kontakt_komentarze_user_id_fkey(id,full_name,avatar_url))`

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const { data: kontakt } = await supabase
    .from('kontakty')
    .select(SELECT_WITH_RELATIONS)
    .eq('id', id)
    .maybeSingle()

  if (!kontakt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Inwestora otworzy centrala/admin ORAZ user z grantem na inwestorów
  if (kontakt.typ === 'inwestor' && !(await userCanSeeInvestors(supabase, user.id, user.role))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Ten sam zakres widoczności co na liście — inaczej kartę cudzego kontaktu
  // dałoby się otworzyć wprost z adresu (np. z pinezki na mapie).
  const visibleIds = await getVisibleUserIds(supabase, user.id, user.role)
  if (visibleIds && !(await canOpenKontakt(supabase, user.id, visibleIds, kontakt))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(kontakt)
}

/**
 * Czy user może otworzyć kartę kontaktu: należy do niego (lub do kogoś z jego
 * zakresu widoczności), został mu udostępniony, albo odblokowuje go grant
 * z panelu dostępów.
 */
async function canOpenKontakt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  visibleIds: string[],
  kontakt: { id: string; typ: string; assigned_to: string | null; created_by: string | null },
): Promise<boolean> {
  const owners = [kontakt.assigned_to, kontakt.created_by].filter((v): v is string => !!v)
  if (owners.some(id => visibleIds.includes(id))) return true

  const grants = await getUserGrants(supabase, userId)
  const g = grants.kontaktTypes[kontakt.typ as keyof typeof grants.kontaktTypes]
  if (g && (g.all || owners.some(id => g.userIds.includes(id)))) return true

  const { data: share } = await supabase
    .from('kontakt_shares')
    .select('id')
    .eq('kontakt_id', kontakt.id)
    .eq('shared_with_user_id', userId)
    .maybeSingle()
  return !!share
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const body = await req.json()
  const statusComment: string | undefined = body.statusComment
  delete body.statusComment

  // Edycja inwestora (lub przełączenie na typ inwestor) — rola LUB grant
  if (!(await userCanSeeInvestors(supabase, user.id, user.role))) {
    const { data: existing } = await supabase.from('kontakty').select('typ').eq('id', id).maybeSingle()
    if (!existing || existing.typ === 'inwestor' || body.typ === 'inwestor') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  }

  // Przypisywanie kontaktu do innego agenta — tylko centrala/admin
  if (!canManageTeams(user.role)) delete body.assigned_to

  // Flagi decyzyjne (chęć współpracy / niezainteresowani) wymagają
  // komentarza uzasadniającego przy każdej zmianie — reszta checkboxów
  // (wizyta, zgody, mail z ofertą) to zwykłe znaczniki aktywności.
  const DECISION_FLAGS = ['chec_wspolpracy', 'niezainteresowani'] as const
  const DECISION_FLAG_LABELS: Record<typeof DECISION_FLAGS[number], string> = {
    chec_wspolpracy: 'Chęć współpracy',
    niezainteresowani: 'Niezainteresowani',
  }
  const changingFlags = DECISION_FLAGS.filter(f => f in body)
  let actuallyChanging: typeof DECISION_FLAGS[number][] = []
  if (changingFlags.length) {
    const { data: current } = await supabase
      .from('kontakty')
      .select('chec_wspolpracy, niezainteresowani')
      .eq('id', id)
      .maybeSingle()
    actuallyChanging = changingFlags.filter(f => current && body[f] !== current[f])
    if (actuallyChanging.length && !statusComment?.trim()) {
      return NextResponse.json({ error: 'Zmiana statusu wymaga komentarza — uzasadnij, dlaczego' }, { status: 400 })
    }
  }

  // Re-geokodowanie, gdy zmieniono adres
  const needsGeocode = ['ulica', 'miasto', 'wojewodztwo'].some(f => f in body)
  let coordPatch = {}
  if (needsGeocode) {
    const { data: current } = await supabase
      .from('kontakty')
      .select('ulica, miasto, wojewodztwo')
      .eq('id', id)
      .maybeSingle()
    const coords = await geocodeAddress(
      body.ulica ?? current?.ulica,
      body.miasto ?? current?.miasto,
      body.wojewodztwo ?? current?.wojewodztwo,
    )
    if (coords) coordPatch = coords
  }

  const { data: kontakt, error } = await supabase
    .from('kontakty')
    .update({ ...body, ...coordPatch })
    .eq('id', id)
    .select(SELECT_WITH_RELATIONS)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (actuallyChanging.length && statusComment) {
    await supabase.from('kontakt_komentarze').insert(
      actuallyChanging.map(f => ({
        kontakt_id: id,
        user_id: user.id,
        content: formatFlagChangeComment(DECISION_FLAG_LABELS[f], body[f], statusComment),
      }))
    )
  }

  return NextResponse.json(kontakt)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  // Usuwać wprost mogą tylko role zarządzające zespołem — zwykły użytkownik
  // zgłasza prośbę o usunięcie (POST /api/deletion-requests)
  if (!canDeleteRecords(user.role)) return forbidden()

  const { error } = await supabase.from('kontakty').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
