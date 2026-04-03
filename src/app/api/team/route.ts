export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const rules = await prisma.teamVisibility.findMany({
    include: {
      manager: { select: { id: true, full_name: true, avatar_url: true, role: true } },
      member: { select: { id: true, full_name: true, avatar_url: true, role: true } },
    },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json(serialize(rules))
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (user.role !== 'admin') return forbidden()

  const { managerId, memberId } = await req.json()

  const rule = await prisma.teamVisibility.create({
    data: {
      manager_id: managerId,
      member_id: memberId,
      created_by: user.id,
    },
  })

  return NextResponse.json(serialize(rule), { status: 201 })
}
