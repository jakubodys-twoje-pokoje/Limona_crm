export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'

const ARCHIVE_DAYS = 90 // twarde usuwanie po tylu dniach

type DB = Awaited<ReturnType<typeof createClient>>

async function countOlderThan(supabase: DB, table: string, cutoff: string): Promise<number> {
  let q = supabase.from(table).select('id', { count: 'exact', head: true }).lt('created_at', cutoff)
  if (table === 'wall_messages') q = q.eq('pinned', false)
  if (table === 'notifications') q = q.eq('read', true)
  const { count } = await q
  return count ?? 0
}

// POST /api/cleanup — usuwa wiadomości starsze niż 90 dni (admin)
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (user.role !== 'admin') return forbidden()
  const supabase = await createClient()

  const cutoff = new Date(Date.now() - ARCHIVE_DAYS * 86400000).toISOString()
  const body = await req.json().catch(() => ({})) as { target?: string }
  const target = body.target ?? 'all'
  const results: Record<string, number> = {}

  if (target === 'all' || target === 'dm') {
    results.directMessages = await countOlderThan(supabase, 'direct_messages', cutoff)
    await supabase.from('direct_messages').delete().lt('created_at', cutoff)
  }
  if (target === 'all' || target === 'groups') {
    results.groupMessages = await countOlderThan(supabase, 'group_messages', cutoff)
    await supabase.from('group_messages').delete().lt('created_at', cutoff)
  }
  if (target === 'all' || target === 'wall') {
    results.wallMessages = await countOlderThan(supabase, 'wall_messages', cutoff)
    await supabase.from('wall_messages').delete().lt('created_at', cutoff).eq('pinned', false)
  }
  if (target === 'all' || target === 'notifications') {
    const notifCutoff = new Date(Date.now() - 30 * 86400000).toISOString()
    results.notifications = await countOlderThan(supabase, 'notifications', notifCutoff)
    await supabase.from('notifications').delete().lt('created_at', notifCutoff).eq('read', true)
  }

  return NextResponse.json({ ok: true, deleted: results, cutoffDate: cutoff })
}

// GET /api/cleanup — podgląd, ile zostałoby usunięte (admin)
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (user.role !== 'admin') return forbidden()
  const supabase = await createClient()

  const cutoff90 = new Date(Date.now() - 90 * 86400000).toISOString()
  const cutoff30 = new Date(Date.now() - 30 * 86400000).toISOString()

  const [dm, groups, wall, notifs] = await Promise.all([
    countOlderThan(supabase, 'direct_messages', cutoff90),
    countOlderThan(supabase, 'group_messages', cutoff90),
    countOlderThan(supabase, 'wall_messages', cutoff90),
    countOlderThan(supabase, 'notifications', cutoff30),
  ])

  return NextResponse.json({
    policy: { chatArchiveDays: 30, chatDeleteDays: 90, notificationDeleteDays: 30 },
    toDelete: { directMessages: dm, groupMessages: groups, wallMessages: wall, readNotifications: notifs },
  })
}
