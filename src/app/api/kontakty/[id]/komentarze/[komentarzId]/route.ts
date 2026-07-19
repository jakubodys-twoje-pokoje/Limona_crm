export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'

const SELECT_WITH_USER = '*, user:profiles!kontakt_komentarze_user_id_fkey(id,full_name,avatar_url)'

// Edytować/usuwać komentarz może jego autor oraz admin (spójnie z RLS).
async function canTouch(komentarzId: string): Promise<{ allowed: boolean; status: number }> {
  const user = await getSessionUser()
  if (!user) return { allowed: false, status: 401 }
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('kontakt_komentarze')
    .select('user_id')
    .eq('id', komentarzId)
    .maybeSingle()
  if (!existing) return { allowed: false, status: 404 }
  if (existing.user_id !== user.id && user.role !== 'admin') return { allowed: false, status: 403 }
  return { allowed: true, status: 200 }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; komentarzId: string }> }) {
  const { komentarzId } = await params
  const { allowed, status } = await canTouch(komentarzId)
  if (!allowed) {
    if (status === 401) return unauthorized()
    if (status === 403) return forbidden()
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { content } = await req.json()
  if (!content?.trim()) {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: komentarz, error } = await supabase
    .from('kontakt_komentarze')
    .update({ content: content.trim(), updated_at: new Date().toISOString() })
    .eq('id', komentarzId)
    .select(SELECT_WITH_USER)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(komentarz)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; komentarzId: string }> }) {
  const { komentarzId } = await params
  const { allowed, status } = await canTouch(komentarzId)
  if (!allowed) {
    if (status === 401) return unauthorized()
    if (status === 403) return forbidden()
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = await createClient()
  const { error } = await supabase.from('kontakt_komentarze').delete().eq('id', komentarzId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
