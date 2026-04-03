import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@limona.pl'
  const password = process.env.ADMIN_PASSWORD || 'admin123'

  const existing = await prisma.profile.findUnique({ where: { email } })
  if (existing) {
    console.log(`Admin already exists: ${email}`)
    return
  }

  const hashed = await bcrypt.hash(password, 12)
  const admin = await prisma.profile.create({
    data: {
      email,
      password: hashed,
      full_name: 'Administrator',
      role: 'admin',
    },
  })

  console.log(`Created admin user: ${admin.email} (${admin.id})`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
