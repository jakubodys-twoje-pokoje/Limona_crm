export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Nazwa jest wymagana' }, { status: 400 })

  const maxPos = await prisma.boardList.aggregate({
    where: { board_id: params.id },
    _max: { position: true },
  })
  const position = (maxPos._max.position ?? -1) + 1

  const list = await prisma.boardList.create({
    data: { board_id: params.id, name: body.name.trim(), position },
  })

  return NextResponse.json(serialize(list), { status: 201 })
}
