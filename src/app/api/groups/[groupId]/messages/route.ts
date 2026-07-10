export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { canManageTeams } from '@/lib/roles'
import type { SupabaseClient } from '@supabase/supabase-js'

const SELECT_WITH_AUTHOR = '*, author:profiles!group_messages_user_id_fkey(id,full_name,avatar_url)'

// groupId = teams.id
async function canAccessGroup(
  supabase: SupabaseClient, userId: string, userRole: string, groupId: string,
): Promise<boolean> {
  if (canManageTeams(userRole)) return true
  const { data } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', groupId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}

// GET /api/groups/[groupId]/messages (?days=30 domyślnie)
export async function GET(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { groupId } = await params

  if (!(await canAccessGroup(supabase, user.id, user.role, groupId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  const cutoff = new Date(Date.now() - days * 86400000).toISOString()

  const { data: messages, error } = await supabase
    .from('group_messages')
    .select(SELECT_WITH_AUTHOR)
    .eq('group_id', groupId)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(messages)
}

// POST /api/groups/[groupId]/messages
export async function POST(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { groupId } = await params

  if (!(await canAccessGroup(supabase, user.id, user.role, groupId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Treść jest wymagana' }, { status: 400 })

  const { data: msg, error } = await supabase
    .from('group_messages')
    .insert({ group_id: groupId, user_id: user.id, content: content.trim() })
    .select(SELECT_WITH_AUTHOR)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Powiadom pozostałych członków zespołu
  const { data: members } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', groupId)
  const memberIds = new Set<string>((members ?? []).map(m => m.user_id))
  memberIds.delete(user.id)
  if (memberIds.size > 0) {
    await supabase.from('notifications').insert(
      Array.from(memberIds).map(memberId => ({
        user_id: memberId,
        from_user_id: user.id,
        type: 'group_message' as const,
        title: `${user.name} napisał/a w grupie`,
        body: content.trim().slice(0, 100),
        link: '/komunikacja',
        reference_id: msg.id,
      }))
    )
  }

  return NextResponse.json(msg, { status: 201 })
}
