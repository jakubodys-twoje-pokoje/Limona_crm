export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { geocodeAddress } from '@/lib/geocode'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const { data: property } = await supabase
    .from('properties')
    .select('adres, miasto')
    .eq('id', id)
    .maybeSingle()
  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const coords = await geocodeAddress(property.adres, property.miasto ?? null, null)
  if (!coords) {
    return NextResponse.json({ error: 'Nie udało się znaleźć adresu' }, { status: 422 })
  }

  const { data: updated, error } = await supabase
    .from('properties')
    .update(coords)
    .eq('id', id)
    .select('id, lat, lng')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(updated)
}
