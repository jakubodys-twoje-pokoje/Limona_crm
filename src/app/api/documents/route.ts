export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { serialize } from '@/lib/serialize'

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const { searchParams } = req.nextUrl
  const propertyId = searchParams.get('propertyId')
  if (!propertyId) return NextResponse.json({ error: 'propertyId required' }, { status: 400 })

  const docs = await prisma.document.findMany({
    where: { property_id: propertyId },
    include: { property: { select: { id: true } } },
    orderBy: { created_at: 'asc' },
  })

  // Attach uploader info manually (no relation in schema to Profile)
  const uploaderIds = Array.from(new Set(docs.map(d => d.uploaded_by).filter(Boolean))) as string[]
  const uploaders = uploaderIds.length
    ? await prisma.profile.findMany({
        where: { id: { in: uploaderIds } },
        select: { id: true, full_name: true, avatar_url: true },
      })
    : []
  const uploaderMap = Object.fromEntries(uploaders.map(u => [u.id, u]))

  const result = docs.map(d => ({
    ...d,
    uploader: d.uploaded_by ? uploaderMap[d.uploaded_by] || null : null,
  }))

  return NextResponse.json(serialize(result))
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const body = await req.json()
  const { property_id, name, file_url, file_type, stage } = body

  if (!property_id || !name?.trim() || !file_url?.trim()) {
    return NextResponse.json({ error: 'property_id, name i file_url są wymagane' }, { status: 400 })
  }

  const doc = await prisma.document.create({
    data: {
      property_id,
      name: name.trim(),
      file_url: file_url.trim(),
      file_type: file_type || null,
      stage: stage || null,
      uploaded_by: user.id,
    },
  })

  return NextResponse.json(serialize(doc), { status: 201 })
}
