export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const boards = await prisma.board.findMany({
    orderBy: { created_at: 'asc' },
    include: { lists: { orderBy: { position: 'asc' } } },
  })

  return NextResponse.json(serialize(boards))
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Nazwa jest wymagana' }, { status: 400 })

  const board = await prisma.board.create({
    data: {
      name: body.name.trim(),
      color: body.color || '#84cc16',
      description: body.description || null,
      created_by: user.id,
    },
  })

  // Create initial lists
  const listNames: string[] = Array.isArray(body.lists) ? body.lists : ['Do zrobienia', 'W toku', 'Gotowe']
  await prisma.boardList.createMany({
    data: listNames.map((name: string, i: number) => ({
      board_id: board.id,
      name,
      position: i,
    })),
  })

  const full = await prisma.board.findUnique({
    where: { id: board.id },
    include: { lists: { orderBy: { position: 'asc' } } },
  })

  return NextResponse.json(serialize(full), { status: 201 })
}
