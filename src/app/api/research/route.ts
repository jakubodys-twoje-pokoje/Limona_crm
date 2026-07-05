export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = createClient()

  const { data, error } = await supabase
    .from('research_queries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = createClient()

  const body = await req.json()

  const { data: query, error } = await supabase
    .from('research_queries')
    .insert({
      person_name: body.personName,
      kw_number: body.kwNumber || null,
      property_id: body.propertyId || null,
      notes: body.notes || null,
      status: 'completed',
      results: body.results || null,
      created_by: user.id,
    })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(query, { status: 201 })
}
