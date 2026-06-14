export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

// GET /api/dm — list distinct conversations with unread counts
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  // Find all profiles I've had a conversation with
  const sent = await prisma.directMessage.findMany({
    where: { from_id: user.id },
    select: { to_id: true },
    distinct: ['to_id'],
  })
  const recv = await prisma.directMessage.findMany({
    where: { to_id: user.id },
    select: { from_id: true },
    distinct: ['from_id'],
  })

  const peerIds = Array.from(new Set([
    ...sent.map((m: { to_id: string }) => m.to_id),
    ...recv.map((m: { from_id: string }) => m.from_id),
  ]))

  if (peerIds.length === 0) return NextResponse.json([])

  const peers = await prisma.profile.findMany({
    where: { id: { in: peerIds } },
    select: { id: true, full_name: true, avatar_url: true, role: true },
  })

  // Get last message + unread count per conversation
  const conversations = await Promise.all(
    peers.map(async peer => {
      const last = await prisma.directMessage.findFirst({
        where: {
          OR: [
            { from_id: user.id, to_id: peer.id },
            { from_id: peer.id, to_id: user.id },
          ],
        },
        orderBy: { created_at: 'desc' },
        select: { content: true, created_at: true, from_id: true },
      })
      const unread = await prisma.directMessage.count({
        where: { from_id: peer.id, to_id: user.id, read: false },
      })
      return { peer, lastMessage: last, unreadCount: unread }
    })
  )

  conversations.sort((a, b) => {
    const aTime = a.lastMessage?.created_at?.getTime() ?? 0
    const bTime = b.lastMessage?.created_at?.getTime() ?? 0
    return bTime - aTime
  })

  return NextResponse.json(serialize(conversations))
}
