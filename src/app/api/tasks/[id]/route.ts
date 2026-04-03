export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const body = await req.json()
  if (body.status === 'done') body.completed_at = new Date()

  const task = await prisma.task.update({
    where: { id: params.id },
    data: body,
  })

  return NextResponse.json(serialize(task))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  await prisma.task.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
