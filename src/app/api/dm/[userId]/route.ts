export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

// GET /api/dm/[userId] — fetch conversation thread
export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const peerId = params.userId

  const messages = await prisma.directMessage.findMany({
    where: {
      OR: [
        { from_id: user.id, to_id: peerId },
        { from_id: peerId,  to_id: user.id },
      ],
    },
    orderBy: { created_at: 'asc' },
    include: {
      sender: { select: { id: true, full_name: true, avatar_url: true } },
    },
    take: 100,
  })

  // Mark incoming messages as read
  await prisma.directMessage.updateMany({
    where: { from_id: peerId, to_id: user.id, read: false },
    data: { read: true },
  })

  return NextResponse.json(serialize(messages))
}

// POST /api/dm/[userId] — send a message
export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Treść jest wymagana' }, { status: 400 })

  const msg = await prisma.directMessage.create({
    data: {
      from_id: user.id,
      to_id:   params.userId,
      content: content.trim(),
    },
    include: {
      sender: { select: { id: true, full_name: true, avatar_url: true } },
    },
  })

  return NextResponse.json(serialize(msg), { status: 201 })
}
