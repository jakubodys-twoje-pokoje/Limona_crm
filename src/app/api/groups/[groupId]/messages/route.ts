export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import type { SupabaseClient } from '@supabase/supabase-js'

const SELECT_WITH_AUTHOR = '*, author:profiles!group_messages_user_id_fkey(id,full_name,avatar_url)'

async function canAccessGroup(
  supabase: SupabaseClient, userId: string, userRole: string, groupId: string,
): Promise<boolean> {
  if (userRole === 'admin') return true
  if (userId === groupId) return true
  const { data } = await supabase
    .from('team_visibility')
    .select('id')
    .eq('manager_id', groupId)
    .eq('member_id', userId)
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

  return NextResponse.json(msg, { status: 201 })
}
