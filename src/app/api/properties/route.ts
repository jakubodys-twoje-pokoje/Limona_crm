export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

const SELECT_WITH_RELATIONS = `*,
  creator:profiles!properties_created_by_fkey(id,full_name,avatar_url),
  assignee:profiles!properties_assigned_to_fkey(id,full_name,avatar_url)`

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const { searchParams } = req.nextUrl
  const visibleIds = searchParams.get('visibleIds')?.split(',').filter(Boolean)

  let query = supabase
    .from('properties')
    .select(SELECT_WITH_RELATIONS)
    .order('created_at', { ascending: false })

  if (visibleIds?.length) {
    const ids = visibleIds.join(',')
    query = query.or(`assigned_to.in.(${ids}),created_by.in.(${ids})`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const body = await req.json()

  const { data: property, error } = await supabase
    .from('properties')
    .insert({ ...body, created_by: user.id })
    .select(SELECT_WITH_RELATIONS)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log activity
  await supabase.from('activity_log').insert({
    property_id: property.id,
    user_id: user.id,
    action: 'created',
    details: { location: property.location },
  })

  return NextResponse.json(property, { status: 201 })
}
