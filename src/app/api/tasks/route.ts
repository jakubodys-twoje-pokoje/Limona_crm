export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { validateTaskRules } from '@/lib/task-rules'

const SELECT_WITH_RELATIONS = `*,
  property:properties!tasks_property_id_fkey(id,adres,kod_pocztowy,miasto,kontakt_id,kontakt:kontakty!properties_kontakt_id_fkey(id,nazwa)),
  kontakt:kontakty!tasks_kontakt_id_fkey(id,nazwa),
  assignee:profiles!tasks_assigned_to_fkey(id,full_name,avatar_url),
  creator:profiles!tasks_created_by_fkey(id,full_name,avatar_url),
  board:boards!tasks_board_id_fkey(id,name,color)`

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const { searchParams } = req.nextUrl
  const propertyId = searchParams.get('propertyId')
  const kontaktId = searchParams.get('kontaktId')
  const visibleIds = searchParams.get('visibleIds')?.split(',').filter(Boolean)
  const boardId = searchParams.get('boardId')
  const dueFrom = searchParams.get('dueFrom')
  const dueTo = searchParams.get('dueTo')

  let query = supabase
    .from('tasks')
    .select(SELECT_WITH_RELATIONS)
    .order('created_at', { ascending: false })

  if (propertyId) query = query.eq('property_id', propertyId)
  if (kontaktId) query = query.eq('kontakt_id', kontaktId)
  // boardId=none -> zadania bez tablicy ("Ogólne"); konkretne id -> ta tablica;
  // brak parametru -> wszystkie tablice naraz (używa tego kalendarz)
  if (boardId === 'none') query = query.is('board_id', null)
  else if (boardId) query = query.eq('board_id', boardId)
  if (dueFrom) query = query.gte('due_date', dueFrom)
  if (dueTo) query = query.lte('due_date', dueTo)
  if (visibleIds?.length) {
    const ids = visibleIds.join(',')
    // widać też zadania, gdzie user jest współprzypisanym (co_assignees[])
    query = query.or(`assigned_to.in.(${ids}),created_by.in.(${ids}),co_assignees.ov.{${ids}}`)
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

  const ruleError = validateTaskRules(body)
  if (ruleError) return NextResponse.json({ error: ruleError }, { status: 400 })

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
