export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  await prisma.notification.update({
    where: { id: params.id, user_id: user.id },
    data: { read: true },
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  await prisma.notification.delete({
    where: { id: params.id, user_id: user.id },
  })

  return NextResponse.json({ ok: true })
}
