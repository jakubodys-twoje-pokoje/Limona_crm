export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  // Only self or admin
  if (user.id !== params.id && user.role !== 'admin') return forbidden()

  const body = await req.json()
  // Don't allow changing password via this route
  delete body.password
  delete body.email

  const profile = await prisma.profile.update({
    where: { id: params.id },
    data: body,
    select: { id: true, full_name: true, avatar_url: true, role: true, email: true, created_at: true, updated_at: true },
  })

  return NextResponse.json(serialize(profile))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (user.role !== 'admin') return forbidden()
  if (user.id === params.id) {
    return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
  }

  await prisma.profile.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
