export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const queries = await prisma.researchQuery.findMany({
    orderBy: { created_at: 'desc' },
    take: 100,
  })

  return NextResponse.json(serialize(queries))
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const body = await req.json()

  const query = await prisma.researchQuery.create({
    data: {
      person_name: body.personName,
      company_name: body.companyName || null,
      kw_number: body.kwNumber || null,
      property_id: body.propertyId || null,
      notes: body.notes || null,
      status: 'completed',
      results: body.results || null,
      created_by: user.id,
    },
  })

  return NextResponse.json(serialize(query), { status: 201 })
}
