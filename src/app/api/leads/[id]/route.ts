export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

const includeRelations = {
  assignee: { select: { id: true, full_name: true, avatar_url: true } },
  creator:  { select: { id: true, full_name: true, avatar_url: true } },
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: includeRelations,
  })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(serialize(lead))
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const body = await req.json()

  const lead = await prisma.lead.update({
    where: { id: params.id },
    data: {
      name:        body.name        ?? undefined,
      phone:       body.phone       ?? undefined,
      email:       body.email       ?? undefined,
      location:    body.location    ?? undefined,
      source:      body.source      ?? undefined,
      notes:       body.notes       ?? undefined,
      status:      body.status      ?? undefined,
      assigned_to: body.assignedTo  !== undefined ? (body.assignedTo || null) : undefined,
      property_id: body.propertyId  !== undefined ? (body.propertyId || null) : undefined,
    },
    include: includeRelations,
  })

  return NextResponse.json(serialize(lead))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  await prisma.lead.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
