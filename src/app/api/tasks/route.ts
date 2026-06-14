export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

const includeRelations = {
  property: { select: { id: true, location: true } },
  assignee: { select: { id: true, full_name: true, avatar_url: true } },
  creator: { select: { id: true, full_name: true, avatar_url: true } },
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const { searchParams } = req.nextUrl
  const propertyId = searchParams.get('propertyId')
  const visibleIds = searchParams.get('visibleIds')?.split(',').filter(Boolean)

  const where: Record<string, unknown> = {}
  if (propertyId) where.property_id = propertyId
  if (visibleIds?.length) {
    where.OR = [
      { assigned_to: { in: visibleIds } },
      { created_by: { in: visibleIds } },
      { co_assignees: { hasSome: visibleIds } },
    ]
  }

  const tasks = await prisma.task.findMany({
    where,
    include: includeRelations,
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json(serialize(tasks))
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const body = await req.json()
  const task = await prisma.task.create({
    data: { ...body, created_by: user.id },
    include: includeRelations,
  })

  if (body.property_id) {
    await prisma.activityLog.create({
      data: {
        property_id: body.property_id,
        task_id: task.id,
        user_id: user.id,
        action: 'task_created',
        details: { title: task.title },
      },
    })
  }

  return NextResponse.json(serialize(task), { status: 201 })
}
