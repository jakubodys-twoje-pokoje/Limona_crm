export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

const includeRelations = {
  assignee: { select: { id: true, full_name: true, avatar_url: true } },
  creator:  { select: { id: true, full_name: true, avatar_url: true } },
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const assignedTo = searchParams.get('assignedTo')

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (assignedTo) where.assigned_to = assignedTo

  // Non-admin/manager only see their own or assigned leads
  if (user.role !== 'admin' && user.role !== 'manager') {
    where.OR = [
      { created_by: user.id },
      { assigned_to: user.id },
    ]
  }

  const leads = await prisma.lead.findMany({
    where,
    include: includeRelations,
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json(serialize(leads))
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const body = await req.json()
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Imię/nazwa jest wymagana' }, { status: 400 })
  }

  const lead = await prisma.lead.create({
    data: {
      name:        body.name.trim(),
      phone:       body.phone || null,
      email:       body.email || null,
      location:    body.location || null,
      source:      body.source || null,
      notes:       body.notes || null,
      status:      'new',
      assigned_to: body.assignedTo || null,
      created_by:  user.id,
    },
    include: includeRelations,
  })

  // Notify all managers and admins about the new lead
  try {
    const managers = await prisma.profile.findMany({
      where: { role: { in: ['admin', 'manager'] } },
      select: { id: true },
    })
    const recipients = managers.filter(m => m.id !== user.id)
    if (recipients.length > 0) {
      await prisma.notification.createMany({
        data: recipients.map(m => ({
          user_id:      m.id,
          from_user_id: user.id,
          type:         'new_lead',
          title:        'Nowy lead',
          body:         `${body.name.trim()}${body.location ? ` — ${body.location}` : ''}`,
          link:         '/leady',
          reference_id: lead.id,
        })),
      })
    }
  } catch { /* non-critical */ }

  return NextResponse.json(serialize(lead), { status: 201 })
}
