export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { geocodeAddress } from '@/lib/geocode'

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
  return NextResponse.json(kontakt)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const body = await req.json()

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

  return NextResponse.json(kontakt)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const { error } = await supabase.from('kontakty').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
