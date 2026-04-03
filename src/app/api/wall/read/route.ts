export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const { messageId } = await req.json()

  await prisma.wallRead.upsert({
    where: { user_id_message_id: { user_id: user.id, message_id: messageId } },
    create: { user_id: user.id, message_id: messageId },
    update: {},
  })

  return NextResponse.json({ ok: true })
}
