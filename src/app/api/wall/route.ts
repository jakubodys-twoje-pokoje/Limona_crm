export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

export async function GET(_req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const { data: messages, error } = await supabase
    .from('wall_messages')
    .select('*, user:profiles!wall_messages_user_id_fkey(id,full_name,avatar_url,role)')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get read IDs for this user (RLS i tak ogranicza do własnych)
  const { data: reads } = await supabase
    .from('wall_reads')
    .select('message_id')
    .eq('user_id', user.id)

  return NextResponse.json({
    messages,
    readIds: (reads ?? []).map(r => r.message_id),
  })
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  const { content } = await req.json()

  const { data: message, error } = await supabase
    .from('wall_messages')
    .insert({ content, user_id: user.id })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-mark own message as read
  await supabase.from('wall_reads').insert({ user_id: user.id, message_id: message.id })

  return NextResponse.json(message, { status: 201 })
}
