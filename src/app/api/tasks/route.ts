export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

const SELECT_WITH_RELATIONS = `*,
  property:properties!tasks_property_id_fkey(id,location),
  assignee:profiles!tasks_assigned_to_fkey(id,full_name,avatar_url),
  creator:profiles!tasks_created_by_fkey(id,full_name,avatar_url)`

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = createClient()

  const { searchParams } = req.nextUrl
  const propertyId = searchParams.get('propertyId')
  const visibleIds = searchParams.get('visibleIds')?.split(',').filter(Boolean)

  let query = supabase
    .from('tasks')
    .select(SELECT_WITH_RELATIONS)
    .order('created_at', { ascending: false })

  if (propertyId) query = query.eq('property_id', propertyId)
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
  const supabase = createClient()

  const body = await req.json()
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({ ...body, created_by: user.id })
    .select(SELECT_WITH_RELATIONS)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.property_id) {
    await supabase.from('activity_log').insert({
      property_id: body.property_id,
      task_id: task.id,
      user_id: user.id,
      action: 'task_created',
      details: { title: task.title },
    })
  }

  return NextResponse.json(task, { status: 201 })
}
