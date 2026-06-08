export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'
import { geocodeAddress } from '@/lib/geocode'

const includeRelations = {
  creator:  { select: { id: true, full_name: true, avatar_url: true } },
  assignee: { select: { id: true, full_name: true, avatar_url: true } },
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const sp = req.nextUrl.searchParams

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {}

  const typ          = sp.get('typ')
  const wojewodztwo  = sp.get('wojewodztwo')
  const miasto       = sp.get('miasto')
  const assignedTo   = sp.get('assigned_to')
  const search       = sp.get('search')

  if (typ)         where.typ         = typ
  if (wojewodztwo) where.wojewodztwo = wojewodztwo
  if (miasto)      where.miasto      = miasto
  if (assignedTo)  where.assigned_to = assignedTo

  // Boolean status filters (only applied when explicitly '1')
  for (const flag of [
    'wizyta_osobista',
    'wyslany_mail_oferta',
    'chec_wspolpracy',
    'niezainteresowani',
    'zgoda_ulotki',
    'zgoda_plakat',
    'operator_budowy_zainteresowani',
  ]) {
    const val = sp.get(flag)
    if (val === '1') where[flag] = true
  }

  if (search) {
    where.OR = [
      { nazwa:        { contains: search, mode: 'insensitive' } },
      { miasto:       { contains: search, mode: 'insensitive' } },
      { ulica:        { contains: search, mode: 'insensitive' } },
      { wojewodztwo:  { contains: search, mode: 'insensitive' } },
    ]
  }

  const kontakty = await prisma.kontakt.findMany({
    where,
    include: includeRelations,
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json(serialize(kontakty))
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const body = await req.json()

  // Auto-geocode on create (non-blocking)
  const coords = await geocodeAddress(body.ulica, body.miasto, body.wojewodztwo)

  const kontakt = await prisma.kontakt.create({
    data: { ...body, created_by: user.id, ...(coords ?? {}) },
    include: includeRelations,
  })

  return NextResponse.json(serialize(kontakt), { status: 201 })
}
