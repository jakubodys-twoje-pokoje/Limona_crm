export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

const SELECT_WITH_KONTAKT = '*, kontakt:kontakty!property_investors_kontakt_id_fkey(id,nazwa,telefon,email,typ)'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const { data, error } = await supabase
    .from('property_investors')
    .select(SELECT_WITH_KONTAKT)
    .eq('property_id', id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const { kontaktId } = await req.json()
  if (!kontaktId) return NextResponse.json({ error: 'kontaktId required' }, { status: 400 })

  const { data: investor, error } = await supabase
    .from('property_investors')
    .insert({ property_id: id, kontakt_id: kontaktId, created_by: user.id })
    .select(SELECT_WITH_KONTAKT)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(investor, { status: 201 })
}
