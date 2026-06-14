export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

async function canAccessGroup(userId: string, userRole: string, groupId: string): Promise<boolean> {
  if (userRole === 'admin') return true
  if (userId === groupId) return true
  const membership = await prisma.teamVisibility.findUnique({
    where: { manager_id_member_id: { manager_id: groupId, member_id: userId } },
  })
  return !!membership
}

// GET /api/groups/[groupId]/messages
// ?days=30 (default) | ?days=90 (archive view)
export async function GET(req: NextRequest, { params }: { params: { groupId: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  if (!(await canAccessGroup(user.id, user.role, params.groupId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  const cutoff = new Date(Date.now() - days * 86400000)

  const messages = await prisma.groupMessage.findMany({
    where: {
      group_id: params.groupId,
      created_at: { gte: cutoff },
    },
    orderBy: { created_at: 'asc' },
    include: {
      author: { select: { id: true, full_name: true, avatar_url: true } },
    },
    take: 200,
  })

  return NextResponse.json(serialize(messages))
}

// POST /api/groups/[groupId]/messages
export async function POST(req: NextRequest, { params }: { params: { groupId: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  if (!(await canAccessGroup(user.id, user.role, params.groupId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Treść jest wymagana' }, { status: 400 })

  const msg = await prisma.groupMessage.create({
    data: {
      group_id: params.groupId,
      user_id:  user.id,
      content:  content.trim(),
    },
    include: {
      author: { select: { id: true, full_name: true, avatar_url: true } },
    },
  })

  return NextResponse.json(serialize(msg), { status: 201 })
}
