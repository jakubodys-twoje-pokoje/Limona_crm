export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const taskId = req.nextUrl.searchParams.get('taskId')
  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

  const comments = await prisma.taskComment.findMany({
    where: { task_id: taskId },
    include: {
      user: { select: { id: true, full_name: true, avatar_url: true } },
    },
    orderBy: { created_at: 'asc' },
  })

  return NextResponse.json(serialize(comments))
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const { taskId, content } = await req.json()

  const comment = await prisma.taskComment.create({
    data: { task_id: taskId, user_id: user.id, content },
    include: {
      user: { select: { id: true, full_name: true, avatar_url: true } },
    },
  })

  return NextResponse.json(serialize(comment), { status: 201 })
}
