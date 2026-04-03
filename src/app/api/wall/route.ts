export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const messages = await prisma.wallMessage.findMany({
    include: {
      user: { select: { id: true, full_name: true, avatar_url: true, role: true } },
    },
    orderBy: [{ pinned: 'desc' }, { created_at: 'desc' }],
    take: 100,
  })

  // Get read IDs for this user
  const reads = await prisma.wallRead.findMany({
    where: { user_id: user.id },
    select: { message_id: true },
  })

  return NextResponse.json({
    messages: serialize(messages),
    readIds: reads.map(r => r.message_id),
  })
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const { content } = await req.json()

  const message = await prisma.wallMessage.create({
    data: { content, user_id: user.id },
  })

  // Auto-mark own message as read
  await prisma.wallRead.create({
    data: { user_id: user.id, message_id: message.id },
  })

  return NextResponse.json(serialize(message), { status: 201 })
}
