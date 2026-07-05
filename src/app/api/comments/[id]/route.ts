export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = createClient()

  const { data: comment } = await supabase
    .from('task_comments')
    .select('id, user_id')
    .eq('id', params.id)
    .maybeSingle()
  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only own comment or admin
  if (comment.user_id !== user.id && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase.from('task_comments').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
