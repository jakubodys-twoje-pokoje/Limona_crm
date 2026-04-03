export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  // Check if email taken
  const existing = await prisma.profile.findUnique({ where: { email } })
  if (existing && existing.id !== user.id) {
    return NextResponse.json({ error: 'Ten email jest już zajęty' }, { status: 409 })
  }

  await prisma.profile.update({
    where: { id: user.id },
    data: { email },
  })

  return NextResponse.json({ ok: true })
}
