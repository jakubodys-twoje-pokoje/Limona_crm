export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { validateTaskRules } from '@/lib/task-rules'
import { canSeeAllTeams, isDzialPrawny, canCreateLegalTasks } from '@/lib/roles'
import { normalizeTaskKind, withPropertyOwnersAsCoAssignees, legalDepartmentIds } from '@/lib/legal-tasks'
import { notifyCardActivity } from '@/lib/notify'
import { canAccessProperty, canAccessKontakt, canAccessLead } from '@/lib/record-access'
import { generateOccurrenceDates } from '@/lib/recurrence'
import type { RecurrenceFreq } from '@/types/database'

const SELECT_WITH_RELATIONS = `*,
  property:properties!tasks_property_id_fkey(id,adres,kod_pocztowy,miasto,kontakt_id,kontakt:kontakty!properties_kontakt_id_fkey(id,nazwa)),
  kontakt:kontakty!tasks_kontakt_id_fkey(id,nazwa,ostatnia_wizyta),
  lead:leads!tasks_lead_id_fkey(id,name),
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
  const leadId = searchParams.get('leadId')
  const visibleIds = searchParams.get('visibleIds')?.split(',').filter(Boolean)
  const boardId = searchParams.get('boardId')
  // kind=prawne|zwykle — rozdzielenie toru prawnego od operacyjnego
  const kind = searchParams.get('kind')
  const dueFrom = searchParams.get('dueFrom')
  const dueTo = searchParams.get('dueTo')

  let query = supabase
    .from('tasks')
    .select(SELECT_WITH_RELATIONS)
    .order('created_at', { ascending: false })

  if (propertyId) query = query.eq('property_id', propertyId)
  if (kontaktId) query = query.eq('kontakt_id', kontaktId)
  if (leadId) query = query.eq('lead_id', leadId)
  // boardId=none -> zadania bez tablicy ("Ogólne"); konkretne id -> ta tablica;
  // brak parametru -> wszystkie tablice naraz (używa tego kalendarz)
  if (boardId === 'none') query = query.is('board_id', null)
  else if (boardId) query = query.eq('board_id', boardId)
  if (dueFrom) query = query.gte('due_date', dueFrom)
  if (dueTo) query = query.lte('due_date', dueTo)
  if (kind === 'prawne' || kind === 'zwykle') query = query.eq('task_kind', kind)
  if (visibleIds?.length) {
    const ids = visibleIds.join(',')
    // widać też zadania, gdzie user jest współprzypisanym (co_assignees[])
    const conds = [`assigned_to.in.(${ids})`, `created_by.in.(${ids})`, `co_assignees.ov.{${ids}}`]
    // Dział prawny widzi WSZYSTKIE zadania prawne (niezależnie od tego, kto
    // je założył) — to jego wspólna kolejka spraw. Opiekun nieruchomości
    // widzi zadania prawne swojej nieruchomości, bo przy tworzeniu trafia
    // do współwykonawców (patrz lib/legal-tasks).
    if (isDzialPrawny(user.role)) conds.push('task_kind.eq.prawne')
    query = query.or(conds.join(','))
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** Sprawdza powiązania zadania (nieruchomość / kontakt / lead) — null gdy OK */
async function checkTaskLinks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; role: string },
  body: { property_id?: string | null; kontakt_id?: string | null; lead_id?: string | null },
): Promise<NextResponse | null> {
  const denied = NextResponse.json(
    { error: 'Nie masz dostępu do karty, z którą próbujesz powiązać zadanie' },
    { status: 403 },
  )
  if (body.property_id && !(await canAccessProperty(supabase, user, body.property_id))) return denied
  if (body.kontakt_id && !(await canAccessKontakt(supabase, user, body.kontakt_id))) return denied
  if (body.lead_id && !(await canAccessLead(supabase, user, body.lead_id))) return denied
  return null
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const body = await req.json()

  const ruleError = validateTaskRules(body)
  if (ruleError) return NextResponse.json({ error: ruleError }, { status: 400 })

  // Powiązać zadanie można tylko z kartą, do której ma się dostęp. Bez tego
  // dałoby się „przypiąć" zadanie do cudzej nieruchomości i otworzyć ją
  // wyjątkiem dla własnych zadań (patrz lib/record-access).
  const linkError = await checkTaskLinks(supabase, user, body)
  if (linkError) return linkError

  // Do toru prawnego kieruje sprawy centrala — zwykły user zakłada tylko
  // zadania zwykłe (UI nie pokazuje mu wyboru rodzaju).
  const taskKind = normalizeTaskKind(body.task_kind)
  if (taskKind === 'prawne' && !canCreateLegalTasks(user.role)) {
    return NextResponse.json(
      { error: 'Zadania prawne zakłada centrala — admin albo kierownik centrali' },
      { status: 403 },
    )
  }

  // Zwykły user zawsze jest głównym wykonawcą własnego zadania — nie może
  // go oddać komuś innemu, może tylko dopisać współwykonawców. Bez
  // wybranego przypisania (rola z uprawnieniami) zadanie trafia do twórcy.
  const assignedTo = canSeeAllTeams(user.role) ? (body.assigned_to ?? user.id) : user.id
  // Główny wykonawca nie może być jednocześnie współwykonawcą (CC)
  const coAssignees = taskKind === 'prawne'
    // Zadanie prawne na nieruchomości widzi też jej opiekun — dopisujemy go
    // do współwykonawców, żeby nie zniknęło mu z listy zadań.
    ? await withPropertyOwnersAsCoAssignees(supabase, {
        propertyId: body.property_id,
        assignedTo,
        coAssignees: body.co_assignees,
      })
    : Array.isArray(body.co_assignees)
      ? body.co_assignees.filter((id: string) => id !== assignedTo)
      : body.co_assignees

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({ ...body, task_kind: taskKind, assigned_to: assignedTo, co_assignees: coAssignees, created_by: user.id })
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

  // Nowe zadanie prawne — powiadom dział prawny i opiekunów nieruchomości,
  // żeby sprawa nie czekała na przypadkowe zauważenie na liście.
  if (taskKind === 'prawne') {
    await notifyCardActivity(supabase, {
      actorId: user.id,
      linkedUserIds: [...(await legalDepartmentIds(supabase)), task.assigned_to, ...(task.co_assignees ?? [])],
      type: 'card_change',
      title: 'Nowe zadanie prawne',
      body: `${user.name} — ${task.title}`,
      link: '/zadania',
      referenceId: task.id,
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
        task_kind: task.task_kind,
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
