export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

export async function POST() {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  await prisma.notification.updateMany({
    where: { user_id: user.id, read: false },
    data: { read: true },
  })

  return NextResponse.json({ ok: true })
}
