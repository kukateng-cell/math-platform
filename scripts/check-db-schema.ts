import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const pc = await prisma.parentChild.findFirst()
  console.log('ParentChild 表字段:', Object.keys(pc || {}))
}
main().finally(() => prisma.$disconnect())
