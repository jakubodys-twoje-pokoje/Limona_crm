export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { id: true, full_name: true, avatar_url: true, role: true, email: true, created_at: true, updated_at: true },
  })

  return NextResponse.json(serialize(profile))
}
