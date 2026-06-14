export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

// GET /api/groups — list groups the current user belongs to
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const groups: { id: string; name: string; memberCount: number; role: string }[] = []

  if (user.role === 'admin' || user.role === 'manager') {
    // Find groups where user is the manager
    const managed = await prisma.teamVisibility.findMany({
      where: { manager_id: user.id },
      include: { member: { select: { id: true, full_name: true, avatar_url: true } } },
    })
    if (managed.length > 0) {
      const manager = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { full_name: true },
      })
      groups.push({
        id: user.id,
        name: `Zespół ${manager?.full_name || 'Menedżer'}`,
        memberCount: managed.length + 1,
        role: 'manager',
      })
    }
  }

  // Find groups where user is a member
  const membership = await prisma.teamVisibility.findMany({
    where: { member_id: user.id },
    include: {
      manager: { select: { id: true, full_name: true } },
    },
  })

  for (const tv of membership) {
    if (!groups.find(g => g.id === tv.manager_id)) {
      const count = await prisma.teamVisibility.count({ where: { manager_id: tv.manager_id } })
      groups.push({
        id: tv.manager_id,
        name: `Zespół ${tv.manager.full_name}`,
        memberCount: count + 1,
        role: 'member',
      })
    }
  }

  // Admin can see all groups
  if (user.role === 'admin') {
    const allManagers = await prisma.teamVisibility.findMany({
      distinct: ['manager_id'],
      where: { manager_id: { not: user.id } },
      include: { manager: { select: { id: true, full_name: true } } },
    })
    for (const tv of allManagers) {
      if (!groups.find(g => g.id === tv.manager_id)) {
        const count = await prisma.teamVisibility.count({ where: { manager_id: tv.manager_id } })
        groups.push({
          id: tv.manager_id,
          name: `Zespół ${tv.manager.full_name}`,
          memberCount: count + 1,
          role: 'member',
        })
      }
    }
  }

  return NextResponse.json(serialize(groups))
}
