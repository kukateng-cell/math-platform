import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  // 1. 確認 DB 欄位型別
  const columns = (await prisma.$queryRaw`
    SELECT table_name, column_name, udt_name
    FROM information_schema.columns
    WHERE table_name IN ('ChildProfile', 'Skill')
      AND column_name IN ('gradeLevel', 'promotionTarget')
    ORDER BY table_name, column_name
  `) as { table_name: string; column_name: string; udt_name: string }[]
  console.log('=== DB 欄位型別 ===')
  for (const c of columns) {
    console.log(`${c.table_name}.${c.column_name} → udt_name: ${c.udt_name}`)
  }

  // 2. 確認 enum 定義存在
  const enumCheck = (await prisma.$queryRaw`
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'GradeLevel'
    ORDER BY e.enumsortorder
  `) as { typname: string; enumlabel: string }[]
  console.log('\n=== GradeLevel enum 值 ===')
  for (const e of enumCheck) {
    console.log(`  ${e.enumlabel}`)
  }

  // 3. 確認既有資料仍可正常讀取
  const childCount = await prisma.childProfile.count()
  const skillCount = await prisma.skill.count()
  console.log(`\n=== 資料完整性 ===`)
  console.log(`ChildProfile: ${childCount} 筆`)
  console.log(`Skill: ${skillCount} 筆`)

  // 4. 抽查幾筆資料的 gradeLevel 值
  const sampleChild = await prisma.childProfile.findFirst({ select: { nickname: true, gradeLevel: true } })
  const sampleSkill = await prisma.skill.findFirst({ select: { code: true, gradeLevel: true } })
  console.log(`\n=== 抽查 ===`)
  console.log(`孩子 ${sampleChild?.nickname}: gradeLevel = ${sampleChild?.gradeLevel}`)
  console.log(`技能 ${sampleSkill?.code}: gradeLevel = ${sampleSkill?.gradeLevel}`)
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1) })
