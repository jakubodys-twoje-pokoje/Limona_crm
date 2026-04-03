import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Puste lub zakomentowane, skoro dodałeś już usera przez SQL
  console.log('Seedowanie pominięte - użytkownik dodany ręcznie.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
