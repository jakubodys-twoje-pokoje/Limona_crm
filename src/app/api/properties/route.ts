export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

const includeRelations = {
  creator: { select: { id: true, full_name: true, avatar_url: true } },
  assignee: { select: { id: true, full_name: true, avatar_url: true } },
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const { searchParams } = req.nextUrl
  const visibleIds = searchParams.get('visibleIds')?.split(',').filter(Boolean)

  const where = visibleIds?.length
    ? {
        OR: [
          { assigned_to: { in: visibleIds } },
          { created_by: { in: visibleIds } },
        ],
      }
    : {}

  const properties = await prisma.property.findMany({
    where,
    include: includeRelations,
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json(serialize(properties))
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const body = await req.json()

  const property = await prisma.property.create({
    data: { ...body, created_by: user.id },
    include: includeRelations,
  })

  // Log activity
  await prisma.activityLog.create({
    data: {
      property_id: property.id,
      user_id: user.id,
      action: 'created',
      details: { location: property.location },
    },
  })

  return NextResponse.json(serialize(property), { status: 201 })
}
