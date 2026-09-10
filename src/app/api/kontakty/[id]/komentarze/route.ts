export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { canAccessKontakt, recordNotFound } from '@/lib/record-access'
import { notifyCardActivity } from '@/lib/notify'

const SELECT_WITH_USER = '*, user:profiles!kontakt_komentarze_user_id_fkey(id,full_name,avatar_url)'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params
  if (!(await canAccessKontakt(supabase, user, id))) return recordNotFound()

  const { data, error } = await supabase
    .from('kontakt_komentarze')
    .select(SELECT_WITH_USER)
    .eq('kontakt_id', id)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params
  if (!(await canAccessKontakt(supabase, user, id))) return recordNotFound()

  const { content } = await req.json()
  if (!content?.trim()) {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }

  const { data: komentarz, error } = await supabase
    .from('kontakt_komentarze')
    .insert({ kontakt_id: id, user_id: user.id, content: content.trim() })
    .select(SELECT_WITH_USER)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: kontakt } = await supabase
    .from('kontakty')
    .select('nazwa, assigned_to, created_by')
    .eq('id', id)
    .maybeSingle()
  if (kontakt) {
    await notifyCardActivity(supabase, {
      actorId: user.id,
      linkedUserIds: [kontakt.assigned_to, kontakt.created_by],
      type: 'card_comment',
      title: 'Komentarz w kontakcie',
      body: `${user.name} — ${kontakt.nazwa}: ${content.trim().slice(0, 120)}`,
      link: `/kontakty/${id}`,
      referenceId: id,
    })
  }

  return NextResponse.json(komentarz, { status: 201 })
}
