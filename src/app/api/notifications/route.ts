export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const notifications = await prisma.notification.findMany({
    where: { user_id: user.id },
    include: {
      from_user: { select: { id: true, full_name: true, avatar_url: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 50,
  })

  return NextResponse.json(serialize(notifications))
}

// DELETE /api/notifications?read=1 — delete all read, omit param = delete all
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const readOnly = req.nextUrl.searchParams.get('read') === '1'

  await prisma.notification.deleteMany({
    where: {
      user_id: user.id,
      ...(readOnly ? { read: true } : {}),
    },
  })

  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const body = await req.json()
  const notification = await prisma.notification.create({
    data: {
      user_id: body.userId,
      from_user_id: body.fromUserId || user.id,
      type: body.type,
      title: body.title,
      body: body.body || null,
      link: body.link || null,
      reference_id: body.referenceId || null,
    },
  })

  return NextResponse.json(serialize(notification), { status: 201 })
}
