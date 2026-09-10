export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { canAccessProperty, recordNotFound } from '@/lib/record-access'

const SELECT_WITH_USER = '*, user:profiles!property_negotiation_notes_user_id_fkey(id,full_name,avatar_url)'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params
  if (!(await canAccessProperty(supabase, user, id))) return recordNotFound()
  const investorId = req.nextUrl.searchParams.get('investorId')

  let query = supabase
    .from('property_negotiation_notes')
    .select(SELECT_WITH_USER)
    .eq('property_id', id)
    .order('created_at', { ascending: false })
  // Bez filtra investorId -> tylko ogólne notatki negocjacyjne (nieprzypisane do oferty)
  query = investorId ? query.eq('investor_id', investorId) : query.is('investor_id', null)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params
  if (!(await canAccessProperty(supabase, user, id))) return recordNotFound()

  const { content, investorId } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const { data: note, error } = await supabase
    .from('property_negotiation_notes')
    .insert({ property_id: id, investor_id: investorId || null, user_id: user.id, content: content.trim() })
    .select(SELECT_WITH_USER)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(note, { status: 201 })
}
