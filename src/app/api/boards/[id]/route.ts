export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const board = await prisma.board.findUnique({
    where: { id: params.id },
    include: { lists: { orderBy: { position: 'asc' } } },
  })
  if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(serialize({ board, lists: board.lists }))
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const body = await req.json()
  const board = await prisma.board.update({
    where: { id: params.id },
    data: {
      name: body.name ?? undefined,
      color: body.color ?? undefined,
      description: body.description ?? undefined,
    },
  })

  return NextResponse.json(serialize(board))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  // Tasks get board_id set to null via onDelete: SetNull
  await prisma.board.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
