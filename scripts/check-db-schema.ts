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
  let deleted = await prisma.practiceSession.deleteMany({
    where: { childId: 'cmra4u0vc0001dsv5omiot1d8', questionsJson: { contains: '__isPromotion' } }
  })
  console.log('✅ 已清理', deleted.count, '个升学测试 session')
  // 清理包含无效模板 ID 的 session
  deleted = await prisma.practiceSession.deleteMany({
    where: { childId: 'cmra4u0vc0001dsv5omiot1d8', questionsJson: { contains: 'cmra4bwqz0001wgb2rj67odtx' } }
  })
  console.log('✅ 已清理', deleted.count, '个失效 session')
  // 清理相关 attempts
  const r = await prisma.attempt.deleteMany({ where: { session: { childId: 'cmra4u0vc0001dsv5omiot1d8', completedAt: null } } })
  console.log('✅ 已清理', r.count, '个未完成作答')
}
main().finally(() => prisma.$disconnect())
