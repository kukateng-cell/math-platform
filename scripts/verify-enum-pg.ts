// 用原始 pg 連線驗證 DB 欄位型別（不經過 Prisma，避免 driver adapter 問題）
import 'dotenv/config'
import pg from 'pg'

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })

async function main() {
  await client.connect()

  // 1. 查欄位型別
  const { rows: cols } = await client.query(`
    SELECT table_name, column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name IN ('ChildProfile', 'Skill')
      AND column_name IN ('gradeLevel', 'promotionTarget')
    ORDER BY table_name, column_name
  `)
  console.log('=== DB 欄位型別 ===')
  for (const c of cols) {
    console.log(`  ${c.table_name}.${c.column_name}: data_type=${c.data_type}, udt_name=${c.udt_name}`)
  }

  // 2. 查 enum 定義
  const { rows: enums } = await client.query(`
    SELECT e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'GradeLevel'
    ORDER BY e.enumsortorder
  `)
  console.log('\n=== GradeLevel enum 值 ===')
  for (const e of enums) {
    console.log(`  ${e.enumlabel}`)
  }

  // 3. 查資料筆數
  const { rows: counts } = await client.query(`
    SELECT
      (SELECT count(*) FROM "ChildProfile") as children,
      (SELECT count(*) FROM "Skill") as skills
  `)
  console.log(`\n=== 資料完整性 ===`)
  console.log(`  ChildProfile: ${counts[0].children} 筆`)
  console.log(`  Skill: ${counts[0].skills} 筆`)

  // 4. 抽查實際值
  const { rows: sampleC } = await client.query(`SELECT nickname, "gradeLevel" FROM "ChildProfile" LIMIT 3`)
  const { rows: sampleS } = await client.query(`SELECT code, "gradeLevel" FROM "Skill" LIMIT 3`)
  console.log(`\n=== 抽查 ChildProfile ===`)
  for (const c of sampleC) console.log(`  ${c.nickname}: ${c.gradeLevel}`)
  console.log(`\n=== 抽查 Skill ===`)
  for (const s of sampleS) console.log(`  ${s.code}: ${s.gradeLevel}`)

  await client.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
