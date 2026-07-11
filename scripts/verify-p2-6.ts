// 驗證 P2-6：DB unique constraint + 跨年級排序正確性
import 'dotenv/config'
import pg from 'pg'

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })

async function main() {
  await client.connect()

  // 0. 嘗試直接加 constraint（如果已存在會報錯，我們捕捉）
  try {
    await client.query(`ALTER TABLE "Skill" ADD CONSTRAINT "Skill_gradeLevel_order_key" UNIQUE ("gradeLevel", "order")`)
    console.log('✅ Constraint 新增成功！')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('already exists')) {
      console.log('ℹ️  Constraint name 已被佔用——查是哪個 table 用了同名')
      const { rows: nameClash } = await client.query(`
        SELECT n.nspname as schema, cls.relname as tablename, con.conname
        FROM pg_constraint con
        JOIN pg_class cls ON con.conrelid = cls.oid
        JOIN pg_namespace n ON cls.relnamespace = n.oid
        WHERE con.conname = 'Skill_gradeLevel_order_key'
      `)
      for (const r of nameClash) {
        console.log(`  → [${r.schema}] ${r.tablename}.${r.conname}`)
      }
    } else {
      console.log('❌ 新增失敗:', msg)
    }
  }

  // 0b. 確認搜尋路徑
  const { rows: searchPath } = await client.query(`SHOW search_path`)
  console.log(`search_path: ${searchPath[0].search_path}`)

  // 1. 確認 unique constraint 存在（列出所有 schema 的所有約束）
  const { rows: allConstraints } = await client.query(`
    SELECT n.nspname as schema, con.conname, con.contype
    FROM pg_constraint con
    JOIN pg_class cls ON con.conrelid = cls.oid
    JOIN pg_namespace n ON cls.relnamespace = n.oid
    WHERE cls.relname = 'Skill'
    ORDER BY n.nspname, con.conname
  `)
  console.log('=== ALL constraints on Skill table (all schemas) ===')
  for (const c of allConstraints) {
    console.log(`  [${c.schema}] ${c.conname} (type=${c.contype})`)
  }

  // 2. 確認沒有重複的 (gradeLevel, order)
  const { rows: dups } = await client.query(`
    SELECT "gradeLevel", "order", count(*) as cnt
    FROM "Skill"
    GROUP BY "gradeLevel", "order"
    HAVING count(*) > 1
  `)
  console.log(`\n=== Duplicate (gradeLevel, order) pairs: ${dups.length} ===`)
  if (dups.length > 0) {
    for (const d of dups) console.log(`  ${d.gradeLevel} order=${d.order}: ${d.cnt} 筆`)
  } else {
    console.log('  ✅ 無重複 — unique constraint 可安全存在')
  }

  // 3. 模擬跨年級排序，確認結果正確
  const { rows: skills } = await client.query(`
    SELECT code, "gradeLevel", "order"
    FROM "Skill"
    WHERE "isActive" = true
    ORDER BY "gradeLevel", "order"
    LIMIT 20
  `)
  console.log(`\n=== 前 20 個技能（按年級→order 排序）===`)
  for (const s of skills) {
    console.log(`  ${s.gradeLevel} order=${String(s.order).padStart(2)} : ${s.code}`)
  }

  await client.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
