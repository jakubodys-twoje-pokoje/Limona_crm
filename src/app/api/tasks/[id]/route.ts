export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { validateTaskRules } from '@/lib/task-rules'
import { TASK_STATUS_LABELS, formatStatusChangeComment } from '@/lib/status-comments'
import type { TaskStatus } from '@/types/database'

const SELECT_WITH_RELATIONS = `*,
  property:properties!tasks_property_id_fkey(id,adres,kod_pocztowy,miasto,kontakt_id,kontakt:kontakty!properties_kontakt_id_fkey(id,nazwa)),
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
    .select('status, task_type, outcome, rejection_reason, rejection_note')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ruleError = validateTaskRules({ ...existing, ...body })
  if (ruleError) return NextResponse.json({ error: ruleError }, { status: 400 })

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

  if (statusChanging && statusComment) {
    await supabase.from('task_comments').insert({
      task_id: id,
      user_id: user.id,
      content: formatStatusChangeComment(TASK_STATUS_LABELS[body.status as TaskStatus], statusComment),
    })
  }

  return NextResponse.json(task)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params

  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
