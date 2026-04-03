export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const propertyId = req.nextUrl.searchParams.get('propertyId')
  if (!propertyId) return NextResponse.json({ error: 'propertyId required' }, { status: 400 })

  const logs = await prisma.activityLog.findMany({
    where: { property_id: propertyId },
    include: {
      user: { select: { id: true, full_name: true, avatar_url: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 50,
  })

  return NextResponse.json(serialize(logs))
}
