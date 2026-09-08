export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { validateTaskRules } from '@/lib/task-rules'
import { TASK_STATUS_LABELS, formatStatusChangeComment } from '@/lib/status-comments'
import { mirrorTaskCommentToCards } from '@/lib/taskCommentMirror'
import { canSeeAllTeams, canCreateLegalTasks } from '@/lib/roles'
import { normalizeTaskKind, withPropertyOwnersAsCoAssignees } from '@/lib/legal-tasks'
import { notifyCardActivity } from '@/lib/notify'
import type { TaskStatus } from '@/types/database'

const SELECT_WITH_RELATIONS = `*,
  property:properties!tasks_property_id_fkey(id,adres,kod_pocztowy,miasto,kontakt_id,kontakt:kontakty!properties_kontakt_id_fkey(id,nazwa)),
  kontakt:kontakty!tasks_kontakt_id_fkey(id,nazwa,ostatnia_wizyta),
  lead:leads!tasks_lead_id_fkey(id,name),
  assignee:profiles!tasks_assigned_to_fkey(id,full_name,avatar_url),
  creator:profiles!tasks_created_by_fkey(id,full_name,avatar_url),
  board:boards!tasks_board_id_fkey(id,name,color)`

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const body = await req.json()
  const statusComment: string | undefined = body.statusComment
  delete body.statusComment

  // Reguły domykania walidujemy na stanie PO zmianie (istniejące + patch)
  const { data: existing } = await supabase
    .from('tasks')
    .select('status, task_type, task_kind, property_id, outcome, rejection_reason, rejection_note, assigned_to, co_assignees')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ruleError = validateTaskRules({ ...existing, ...body })
  if (ruleError) return NextResponse.json({ error: ruleError }, { status: 400 })

  // Zwykły user nie może przełożyć zadania na kogoś innego (ani przejąć
  // cudzego) — tylko role z uprawnieniami zarządzania zespołem to robią
  if ('assigned_to' in body && !canSeeAllTeams(user.role)) delete body.assigned_to

  // Główny wykonawca nie może być jednocześnie współwykonawcą (CC)
  if ('assigned_to' in body || 'co_assignees' in body) {
    const finalAssignedTo = 'assigned_to' in body ? body.assigned_to : existing.assigned_to
    const finalCoAssignees = 'co_assignees' in body ? body.co_assignees : existing.co_assignees
    if (finalAssignedTo && Array.isArray(finalCoAssignees)) {
      body.co_assignees = finalCoAssignees.filter((cid: string) => cid !== finalAssignedTo)
    }
  }

  // Rodzaj zadania (zwykłe / prawne). Gdy zadanie staje się prawne,
  // opiekunowie powiązanej nieruchomości dołączają do współwykonawców —
  // inaczej zadanie zniknęłoby im z listy, mimo że dotyczy ich sprawy.
  if ('task_kind' in body) {
    body.task_kind = normalizeTaskKind(body.task_kind)
    // Przełączać tor zwykły ↔ prawny może tylko centrala
    if (body.task_kind !== existing.task_kind && !canCreateLegalTasks(user.role)) {
      return NextResponse.json(
        { error: 'Rodzaj zadania (zwykłe / prawne) zmienia centrala — admin albo kierownik centrali' },
        { status: 403 },
      )
    }
    if (body.task_kind === 'prawne' && existing.task_kind !== 'prawne') {
      body.co_assignees = await withPropertyOwnersAsCoAssignees(supabase, {
        propertyId: 'property_id' in body ? body.property_id : existing.property_id,
        assignedTo: 'assigned_to' in body ? body.assigned_to : existing.assigned_to,
        coAssignees: 'co_assignees' in body ? body.co_assignees : existing.co_assignees,
      })
    }
  }

  // Każda zmiana statusu wymaga komentarza uzasadniającego (dlaczego?)
  const statusChanging = typeof body.status === 'string' && body.status !== existing.status
  if (statusChanging && !statusComment?.trim()) {
    return NextResponse.json({ error: 'Zmiana statusu wymaga komentarza — uzasadnij, dlaczego' }, { status: 400 })
  }

  if (body.status === 'done') body.completed_at = new Date().toISOString()

  const { data: task, error } = await supabase
    .from('tasks')
    .update(body)
    .eq('id', id)
    .select(SELECT_WITH_RELATIONS)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Domknięcie zadania typu „wizyta" powiązanego z kontaktem oznacza wizytę
  // na karcie kontaktu (data z terminu zadania albo dziś)
  if (body.status === 'done' && task.task_type === 'wizyta' && task.kontakt_id) {
    const visitDate = (task.due_date ? String(task.due_date).slice(0, 10) : null) || new Date().toISOString().slice(0, 10)
    await supabase.from('kontakty').update({ ostatnia_wizyta: visitDate }).eq('id', task.kontakt_id)
  }

  if (statusChanging && statusComment) {
    const statusText = formatStatusChangeComment(TASK_STATUS_LABELS[body.status as TaskStatus], statusComment)
    await supabase.from('task_comments').insert({
      task_id: id,
      user_id: user.id,
      content: statusText,
    })

    // Domknięcie/zmiana statusu z opisem trafia też na powiązaną kartę —
    // agent nie musi przeklejać, co ustalił (np. „SM Piast").
    await mirrorTaskCommentToCards(supabase, task, statusText, user.id)

    // Powiadom kierownictwo i osoby powiązane z zadaniem o zmianie statusu
    await notifyCardActivity(supabase, {
      actorId: user.id,
      linkedUserIds: [task.assigned_to, task.created_by, ...(task.co_assignees ?? [])],
      type: 'card_change',
      title: `Zadanie: ${TASK_STATUS_LABELS[body.status as TaskStatus]}`,
      body: `${user.name} — ${task.title}${statusComment ? `: ${statusComment}` : ''}`,
      link: '/zadania',
      referenceId: id,
    })
  }

  return NextResponse.json(task)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params
  // scope=one (domyślnie) — tylko to wystąpienie; scope=following — to i
  // kolejne wystąpienia serii; scope=series — cała seria (wszystkie wystąpienia).
  const scope = req.nextUrl.searchParams.get('scope') ?? 'one'

  if (scope === 'one') {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const { data: current } = await supabase
    .from('tasks')
    .select('id, due_date, recurrence_parent_id')
    .eq('id', id)
    .maybeSingle()
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const rootId = current.recurrence_parent_id ?? current.id
  let query = supabase.from('tasks').delete().or(`id.eq.${rootId},recurrence_parent_id.eq.${rootId}`)
  if (scope === 'following' && current.due_date) {
    query = query.gte('due_date', current.due_date)
  }
  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
