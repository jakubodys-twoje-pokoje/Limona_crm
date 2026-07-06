export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

// GET /api/dm — lista rozmów z licznikiem nieprzeczytanych
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()

  // Wszystkie moje wiadomości (RLS ogranicza do rozmów, w których biorę udział)
  const { data: msgs, error } = await supabase
    .from('direct_messages')
    .select('from_id, to_id, content, created_at, read')
    .or(`from_id.eq.${user.id},to_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Grupowanie po rozmówcy — ostatnia wiadomość + liczba nieprzeczytanych
  const peers = new Map<string, { lastMessage: { content: string; created_at: string; from_id: string }; unreadCount: number }>()
  for (const m of msgs ?? []) {
    const peerId = m.from_id === user.id ? m.to_id : m.from_id
    let entry = peers.get(peerId)
    if (!entry) {
      entry = { lastMessage: { content: m.content, created_at: m.created_at, from_id: m.from_id }, unreadCount: 0 }
      peers.set(peerId, entry)
    }
    if (m.to_id === user.id && !m.read) entry.unreadCount++
  }

  if (peers.size === 0) return NextResponse.json([])

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role')
    .in('id', Array.from(peers.keys()))
  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  const conversations = Array.from(peers.entries())
    .map(([peerId, v]) => ({ peer: profileMap[peerId] ?? { id: peerId }, ...v }))
    .sort((a, b) => (b.lastMessage?.created_at ?? '').localeCompare(a.lastMessage?.created_at ?? ''))

  return NextResponse.json(conversations)
}
