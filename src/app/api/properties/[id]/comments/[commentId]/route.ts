export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'

const SELECT_WITH_USER = '*, user:profiles!property_comments_user_id_fkey(id,full_name,avatar_url)'

// Edytować/usuwać komentarz może jego autor oraz admin (spójnie z RLS).
async function canTouch(commentId: string): Promise<{ allowed: boolean; status: number }> {
  const user = await getSessionUser()
  if (!user) return { allowed: false, status: 401 }
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('property_comments')
    .select('user_id')
    .eq('id', commentId)
    .maybeSingle()
  if (!existing) return { allowed: false, status: 404 }
  if (existing.user_id !== user.id && user.role !== 'admin') return { allowed: false, status: 403 }
  return { allowed: true, status: 200 }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const { commentId } = await params
  const { allowed, status } = await canTouch(commentId)
  if (!allowed) {
    if (status === 401) return unauthorized()
    if (status === 403) return forbidden()
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const supabase = await createClient()
  const { data: comment, error } = await supabase
    .from('property_comments')
    .update({ content: content.trim(), updated_at: new Date().toISOString() })
    .eq('id', commentId)
    .select(SELECT_WITH_USER)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(comment)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const { commentId } = await params
  const { allowed, status } = await canTouch(commentId)
  if (!allowed) {
    if (status === 401) return unauthorized()
    if (status === 403) return forbidden()
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = await createClient()
  const { error } = await supabase.from('property_comments').delete().eq('id', commentId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
