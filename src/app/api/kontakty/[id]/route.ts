export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

const includeRelations = {
  creator:  { select: { id: true, full_name: true, avatar_url: true } },
  assignee: { select: { id: true, full_name: true, avatar_url: true } },
  komentarze: {
    include: {
      user: { select: { id: true, full_name: true, avatar_url: true } },
    },
    orderBy: { created_at: 'asc' as const },
  },
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const kontakt = await prisma.kontakt.findUnique({
    where: { id: params.id },
    include: includeRelations,
  })

  if (!kontakt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(serialize(kontakt))
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const body = await req.json()

  const kontakt = await prisma.kontakt.update({
    where: { id: params.id },
    data: body,
    include: includeRelations,
  })

  return NextResponse.json(serialize(kontakt))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  await prisma.kontakt.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
