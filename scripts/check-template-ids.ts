import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const s = await prisma.practiceSession.findUnique({ where: { id: 'cmra4u1pi0003dsv5j3lcguro' } })
  if (!s?.questionsJson) { console.log('No questionsJson'); return }
  const q = JSON.parse(s.questionsJson)
  const templateIds = q.map((x: any) => x.templateId).filter(Boolean)
  console.log('session 中 templateIds 数量:', templateIds.length)

  // 分批检查
  const batchSize = 100
  let validCount = 0
  for (let i = 0; i < templateIds.length; i += batchSize) {
    const batch = templateIds.slice(i, i + batchSize)
    validCount += await prisma.questionTemplate.count({ where: { id: { in: batch } } })
  }
  console.log('数据库中存在的:', validCount, '/', templateIds.length)

  if (validCount < templateIds.length) {
    const existing = new Set((await prisma.questionTemplate.findMany({ select: { id: true } })).map(x => x.id))
    const invalid = templateIds.filter((id: string) => !existing.has(id))
    console.log('无效 ID 示例:', invalid.slice(0, 5))
    console.log('有效 ID 示例（前 3 个）:', templateIds.filter((id: string) => existing.has(id)).slice(0, 3))
  }
}
main().finally(() => prisma.$disconnect())
