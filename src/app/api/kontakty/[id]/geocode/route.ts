export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { canAccessKontakt, recordNotFound } from '@/lib/record-access'
import { geocodeAddress } from '@/lib/geocode'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params
  if (!(await canAccessKontakt(supabase, user, id))) return recordNotFound()

  const { data: kontakt } = await supabase
    .from('kontakty')
    .select('ulica, miasto, wojewodztwo')
    .eq('id', id)
    .maybeSingle()
  if (!kontakt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const coords = await geocodeAddress(kontakt.ulica, kontakt.miasto, kontakt.wojewodztwo)
  if (!coords) {
    return NextResponse.json({ error: 'Nie udało się znaleźć adresu' }, { status: 422 })
  }

  const { data: updated, error } = await supabase
    .from('kontakty')
    .update(coords)
    .eq('id', id)
    .select('id, lat, lng')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(updated)
}
