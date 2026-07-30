export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { notifyCardActivity } from '@/lib/notify'

const SELECT_WITH_USER = '*, user:profiles!task_comments_user_id_fkey(id,full_name,avatar_url)'

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const taskId = req.nextUrl.searchParams.get('taskId')
  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

  const { data, error } = await supabase
    .from('task_comments')
    .select(SELECT_WITH_USER)
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const { taskId, content } = await req.json()

  const { data: comment, error } = await supabase
    .from('task_comments')
    .insert({ task_id: taskId, user_id: user.id, content })
    .select(SELECT_WITH_USER)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Powiadom kierownictwo i osoby powiązane z zadaniem o nowym komentarzu
  const { data: task } = await supabase
    .from('tasks')
    .select('title, assigned_to, created_by, co_assignees')
    .eq('id', taskId)
    .maybeSingle()
  if (task) {
    await notifyCardActivity(supabase, {
      actorId: user.id,
      linkedUserIds: [task.assigned_to, task.created_by, ...(task.co_assignees ?? [])],
      type: 'card_comment',
      title: `Komentarz w zadaniu`,
      body: `${user.name} — ${task.title}: ${String(content).slice(0, 120)}`,
      link: '/zadania',
      referenceId: taskId,
    })
  }

  return NextResponse.json(comment, { status: 201 })
}
