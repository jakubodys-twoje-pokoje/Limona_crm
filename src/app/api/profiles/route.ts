export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const profiles = await prisma.profile.findMany({
    select: { id: true, full_name: true, avatar_url: true, role: true, email: true, created_at: true, updated_at: true },
    orderBy: { full_name: 'asc' },
  })

  return NextResponse.json(serialize(profiles))
}
