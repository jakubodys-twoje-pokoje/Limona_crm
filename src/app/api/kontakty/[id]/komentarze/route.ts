export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

const includeUser = {
  user: { select: { id: true, full_name: true, avatar_url: true } },
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const komentarze = await prisma.kontaktKomentarz.findMany({
    where: { kontakt_id: params.id },
    include: includeUser,
    orderBy: { created_at: 'asc' },
  })

  return NextResponse.json(serialize(komentarze))
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const { content } = await req.json()
  if (!content?.trim()) {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }

  const komentarz = await prisma.kontaktKomentarz.create({
    data: { kontakt_id: params.id, user_id: user.id, content: content.trim() },
    include: includeUser,
  })

  return NextResponse.json(serialize(komentarz), { status: 201 })
}
