export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

const ARCHIVE_DAYS = 90 // hard delete after this many days

// POST /api/cleanup — delete messages older than 90 days (admin only)
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const cutoff = new Date(Date.now() - ARCHIVE_DAYS * 86400000)
  const body = await req.json().catch(() => ({})) as { target?: string }
  const target = body.target ?? 'all'

  const results: Record<string, number> = {}

  if (target === 'all' || target === 'dm') {
    const { count } = await prisma.directMessage.deleteMany({
      where: { created_at: { lt: cutoff } },
    })
    results.directMessages = count
  }

  if (target === 'all' || target === 'groups') {
    const { count } = await prisma.groupMessage.deleteMany({
      where: { created_at: { lt: cutoff } },
    })
    results.groupMessages = count
  }

  if (target === 'all' || target === 'wall') {
    const { count } = await prisma.wallMessage.deleteMany({
      where: { created_at: { lt: cutoff }, pinned: false },
    })
    results.wallMessages = count
  }

  if (target === 'all' || target === 'notifications') {
    const notifCutoff = new Date(Date.now() - 30 * 86400000)
    const { count } = await prisma.notification.deleteMany({
      where: { created_at: { lt: notifCutoff }, read: true },
    })
    results.notifications = count
  }

  return NextResponse.json({ ok: true, deleted: results, cutoffDate: cutoff.toISOString() })
}

// GET /api/cleanup — preview what would be deleted
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const cutoff90 = new Date(Date.now() - 90 * 86400000)
  const cutoff30 = new Date(Date.now() - 30 * 86400000)

  const [dm, groups, wall, notifs] = await Promise.all([
    prisma.directMessage.count({ where: { created_at: { lt: cutoff90 } } }),
    prisma.groupMessage.count({ where: { created_at: { lt: cutoff90 } } }),
    prisma.wallMessage.count({ where: { created_at: { lt: cutoff90 }, pinned: false } }),
    prisma.notification.count({ where: { created_at: { lt: cutoff30 }, read: true } }),
  ])

  return NextResponse.json({
    policy: { chatArchiveDays: 30, chatDeleteDays: 90, notificationDeleteDays: 30 },
    toDelete: {
      directMessages: dm,
      groupMessages: groups,
      wallMessages: wall,
      readNotifications: notifs,
    },
  })
}
