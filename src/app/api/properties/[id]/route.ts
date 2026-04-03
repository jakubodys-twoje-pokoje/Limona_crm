export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

const includeRelations = {
  creator: { select: { id: true, full_name: true, avatar_url: true } },
  assignee: { select: { id: true, full_name: true, avatar_url: true } },
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const property = await prisma.property.findUnique({
    where: { id: params.id },
    include: includeRelations,
  })

  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(serialize(property))
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const body = await req.json()
  const property = await prisma.property.update({
    where: { id: params.id },
    data: body,
    include: includeRelations,
  })

  await prisma.activityLog.create({
    data: {
      property_id: params.id,
      user_id: user.id,
      action: 'updated',
      details: body,
    },
  })

  return NextResponse.json(serialize(property))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  await prisma.property.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
