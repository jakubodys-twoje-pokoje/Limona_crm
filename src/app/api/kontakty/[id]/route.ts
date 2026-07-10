export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import { geocodeAddress } from '@/lib/geocode'
import { formatFlagChangeComment } from '@/lib/status-comments'
import { canSeeInvestors, canManageTeams } from '@/lib/roles'

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
  if (kontakt.typ === 'inwestor' && !canSeeInvestors(user.role)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(kontakt)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const body = await req.json()
  const statusComment: string | undefined = body.statusComment
  delete body.statusComment

  if (!canSeeInvestors(user.role)) {
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
  if (user.role !== 'admin') return forbidden()
  const supabase = await createClient()
  const { id } = await params

  if (!canSeeInvestors(user.role)) {
    const { data: existing } = await supabase.from('kontakty').select('typ').eq('id', id).maybeSingle()
    if (!existing || existing.typ === 'inwestor') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await supabase.from('kontakty').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
