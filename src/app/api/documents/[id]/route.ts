export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/api-auth'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const doc = await prisma.document.findUnique({ where: { id: params.id } })
  if (!doc) return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 })

  // Only uploader or admin can delete
  if (doc.uploaded_by !== user.id && user.role !== 'admin') {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })
  }

  await prisma.document.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const body = await req.json()
  const doc = await prisma.document.update({
    where: { id: params.id },
    data: {
      name:      body.name?.trim()     || undefined,
      file_url:  body.file_url?.trim() || undefined,
      file_type: body.file_type        || undefined,
      stage:     body.stage            ?? undefined,
    },
  })
  return NextResponse.json(doc)
}
