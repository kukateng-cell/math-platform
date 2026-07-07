import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // 恢复年级
  await prisma.childProfile.update({ where: { id: 'cmra4u0vc0001dsv5omiot1d8' }, data: { gradeLevel: 'K' } })
  console.log('✅ 已恢复为 K')
  // 清理 promotion session
  const deleted = await prisma.practiceSession.deleteMany({
    where: { childId: 'cmra4u0vc0001dsv5omiot1d8', questionsJson: { contains: '__isPromotion' } }
  })
  console.log('✅ 已清理', deleted.count, '个升学测试 session')
}
main().finally(() => prisma.$disconnect())
