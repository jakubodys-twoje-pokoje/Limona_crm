export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'
import { geocodeAddress } from '@/lib/geocode'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const kontakt = await prisma.kontakt.findUnique({
    where: { id: params.id },
    select: { ulica: true, miasto: true, wojewodztwo: true },
  })
  if (!kontakt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const coords = await geocodeAddress(kontakt.ulica, kontakt.miasto, kontakt.wojewodztwo)
  if (!coords) {
    return NextResponse.json({ error: 'Nie udało się znaleźć adresu' }, { status: 422 })
  }

  const updated = await prisma.kontakt.update({
    where: { id: params.id },
    data: coords,
    select: { id: true, lat: true, lng: true },
  })

  return NextResponse.json(serialize(updated))
}
