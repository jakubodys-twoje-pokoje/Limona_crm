export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized, forbidden } from '@/lib/api-auth'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (user.role !== 'admin') return forbidden()

  const { email, password, fullName, role } = await req.json()
  if (!email || !password || !fullName) {
    return NextResponse.json({ error: 'Wymagane: email, hasło, imię' }, { status: 400 })
  }

  const existing = await prisma.profile.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'Ten email jest już zajęty' }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)
  const profile = await prisma.profile.create({
    data: {
      email,
      password: hashed,
      full_name: fullName,
      role: role || 'user',
    },
  })

  return NextResponse.json({ id: profile.id, email: profile.email, full_name: profile.full_name }, { status: 201 })
}
