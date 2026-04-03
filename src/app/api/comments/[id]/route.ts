export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const comment = await prisma.taskComment.findUnique({ where: { id: params.id } })
  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only own comment or admin
  if (comment.user_id !== user.id && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.taskComment.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
