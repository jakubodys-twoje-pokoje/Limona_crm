export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { validateTaskRules } from '@/lib/task-rules'
import { canSeeAllTeams } from '@/lib/roles'
import { generateOccurrenceDates } from '@/lib/recurrence'
import type { RecurrenceFreq } from '@/types/database'

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

  // Zwykły user zawsze jest głównym wykonawcą własnego zadania — nie może
  // go oddać komuś innemu, może tylko dopisać współwykonawców. Bez
  // wybranego przypisania (rola z uprawnieniami) zadanie trafia do twórcy.
  const assignedTo = canSeeAllTeams(user.role) ? (body.assigned_to ?? user.id) : user.id
  // Główny wykonawca nie może być jednocześnie współwykonawcą (CC)
  const coAssignees = Array.isArray(body.co_assignees)
    ? body.co_assignees.filter((id: string) => id !== assignedTo)
    : body.co_assignees

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({ ...body, assigned_to: assignedTo, co_assignees: coAssignees, created_by: user.id })
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

  // Zadanie cykliczne — każde wystąpienie to osobny wiersz (własne
  // komentarze i status), powiązany z pierwszym przez recurrence_parent_id.
  if (task.recurrence_freq && task.due_date) {
    const occurrenceDates = generateOccurrenceDates(
      task.due_date,
      task.recurrence_freq as RecurrenceFreq,
      task.recurrence_interval,
      task.recurrence_until,
    )
    if (occurrenceDates.length > 0) {
      const occurrences = occurrenceDates.map(dueDate => ({
        title: task.title,
        description: task.description,
        status: 'todo',
        priority: task.priority,
        task_type: task.task_type,
        contact_category: task.contact_category,
        due_date: dueDate,
        due_time: task.due_time,
        assigned_to: task.assigned_to,
        co_assignees: task.co_assignees,
        board_id: task.board_id,
        list_id: task.list_id,
        property_id: task.property_id,
        kontakt_id: task.kontakt_id,
        created_by: user.id,
        recurrence_freq: task.recurrence_freq,
        recurrence_interval: task.recurrence_interval,
        recurrence_until: task.recurrence_until,
        recurrence_parent_id: task.id,
      }))
      await supabase.from('tasks').insert(occurrences)
    }
  }

  return NextResponse.json(task, { status: 201 })
}
