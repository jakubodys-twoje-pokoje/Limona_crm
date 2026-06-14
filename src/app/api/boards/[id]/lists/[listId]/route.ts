export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

export async function PATCH(req: NextRequest, { params }: { params: { id: string; listId: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const body = await req.json()
  const list = await prisma.boardList.update({
    where: { id: params.listId },
    data: {
      name:     body.name     ?? undefined,
      position: body.position ?? undefined,
    },
  })

  return NextResponse.json(serialize(list))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; listId: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  // Tasks get list_id = null via onDelete: SetNull
  await prisma.boardList.delete({ where: { id: params.listId } })
  return NextResponse.json({ ok: true })
}
