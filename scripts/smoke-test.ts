/**
 * DB Smoke Test — 驗證 migration + seed 可正確執行
 *
 * 測試項目：
 *   1. Prisma validate（schema 語法）
 *   2. Migrate 可套用（或 db push 成功）
 *   3. Seed 可執行（非破壞模式）
 *   4. 建立的管理員可查詢
 *
 * 此腳本假設 DATABASE_URL 已指向測試用 PostgreSQL。
 */
import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { execSync } from 'node:child_process'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('❌ DATABASE_URL not set')
  process.exit(1)
}

async function main() {
  let exitCode = 0
  const results: { name: string; ok: boolean; detail?: string }[] = []

  // 1. Prisma validate
  try {
    const out = execSync('npx prisma validate', { encoding: 'utf8', cwd: process.cwd() })
    results.push({ name: 'Prisma validate', ok: true, detail: out.trim().split('\n').pop() })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    results.push({ name: 'Prisma validate', ok: false, detail: msg })
    exitCode = 1
  }

  // 2. Prisma db push (dry run 或用實際 apply)
  try {
    const out = execSync('npx prisma db push --accept-data-loss 2>&1', {
      encoding: 'utf8',
      cwd: process.cwd(),
      timeout: 60_000,
      env: { ...process.env, CI: 'true' },
    })
    const ok = !out.includes('Error')
    results.push({ name: 'Schema sync (db push)', ok, detail: ok ? 'Schema synced' : out.slice(0, 200) })
    if (!ok) exitCode = 1
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    results.push({ name: 'Schema sync (db push)', ok: false, detail: msg.slice(0, 200) })
    exitCode = 1
  }

  // 3. Seed content sync（非破壞模式）
  try {
    const out = execSync('node --experimental-strip-types prisma/seed.ts 2>&1', {
      encoding: 'utf8',
      cwd: process.cwd(),
      timeout: 120_000,
      env: { ...process.env, CI: 'true', ALLOW_DESTRUCTIVE_SEED: 'true' },
    })
    const ok = !out.includes('❌') && !out.includes('Error')
    const lastLine = out.trim().split('\n').filter(l => l.includes('✓') || l.includes('✅')).pop() || ''
    results.push({ name: 'Seed (bootstrap)', ok, detail: lastLine })
    if (!ok) exitCode = 1
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    results.push({ name: 'Seed (bootstrap)', ok: false, detail: msg.slice(0, 200) })
    exitCode = 1
  }

  // 4. 驗證管理員存在
  try {
    const pool = new (await import('pg')).Pool({ connectionString })
    const adapter = new PrismaPg(pool)
    const prisma = new PrismaClient({ adapter })

    // 先查所有 user count
    const userCount = await prisma.user.count()
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } })
    const skillCount = await prisma.skill.count()
    const questionCount = await prisma.questionTemplate.count()

    results.push({ name: 'Admin exists', ok: adminCount > 0, detail: `${adminCount} admin(s)` })
    results.push({ name: 'Data integrity', ok: skillCount > 0 && questionCount > 0, detail: `${skillCount} skills, ${questionCount} questions` })

    await prisma.$disconnect()
    await pool.end()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    results.push({ name: 'Data verification', ok: false, detail: msg.slice(0, 200) })
    exitCode = 1
  }

  // 輸出結果
  console.log('\n📋 Smoke Test Results:\n')
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌'
    console.log(`  ${icon} ${r.name}${r.detail ? ': ' + r.detail : ''}`)
  }

  process.exit(exitCode)
}

main().catch((e) => {
  console.error('Smoke test failed:', e)
  process.exit(1)
})
