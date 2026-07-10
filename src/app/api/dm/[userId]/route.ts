export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

const SELECT_WITH_SENDER = '*, sender:profiles!direct_messages_from_id_fkey(id,full_name,avatar_url)'

// GET /api/dm/[userId] — wątek rozmowy (?days=30 domyślnie)
export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { userId: peerId } = await params

  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  const cutoff = new Date(Date.now() - days * 86400000).toISOString()

  const { data: messages, error } = await supabase
    .from('direct_messages')
    .select(SELECT_WITH_SENDER)
    .or(`and(from_id.eq.${user.id},to_id.eq.${peerId}),and(from_id.eq.${peerId},to_id.eq.${user.id})`)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Oznacz przychodzące jako przeczytane
  await supabase
    .from('direct_messages')
    .update({ read: true })
    .eq('from_id', peerId)
    .eq('to_id', user.id)
    .eq('read', false)

  return NextResponse.json(messages)
}

// POST /api/dm/[userId] — wyślij wiadomość
export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { userId: peerId } = await params

  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Treść jest wymagana' }, { status: 400 })

  const { data: msg, error } = await supabase
    .from('direct_messages')
    .insert({ from_id: user.id, to_id: peerId, content: content.trim() })
    .select(SELECT_WITH_SENDER)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (peerId !== user.id) {
    await supabase.from('notifications').insert({
      user_id: peerId,
      from_user_id: user.id,
      type: 'dm_message',
      title: `${user.name} wysłał/a Ci wiadomość`,
      body: content.trim().slice(0, 100),
      link: '/komunikacja',
      reference_id: msg.id,
    })
  }

  return NextResponse.json(msg, { status: 201 })
}
