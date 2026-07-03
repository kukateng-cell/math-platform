// ============================================================================
// 演示資料清除器 (Demo Data Cleaner)
// 一鍵清除所有「假的」演示資料（email 含 @demo.com 的家長帳號與孩子檔案）。
// 由於 ChildProfile 設有 cascade，刪除孩子檔案會自動連帶刪除其
// sessions / attempts / masterySnapshots / badges 等關聯資料。
//
// 執行：npm run db:clean:demo
//
// 特性：
// - 冪等：沒有 demo 資料時也不會報錯
// - 安全：只刪除 email 含 @demo.com 的帳號，絕不會動到正式資料
// - 透明：刪除前先統計將被刪除的資料量，刪除後回報實際刪除數量
// ============================================================================

import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🧹 開始清除演示資料 (email 含 @demo.com)...\n')

  // ---------- 先統計將被刪除的資料量（供確認）----------
  const demoUsers = await prisma.user.findMany({
    where: { email: { contains: '@demo.com' } },
    select: { id: true, name: true, email: true },
  })
  const demoUserIds = demoUsers.map((u) => u.id)

  // 孩子檔案可能來自兩種途徑，必須兩者都抓：
  // 1. SELF_STUDY 自主學習學生：自己有 @demo.com 信箱
  // 2. STANDARD 模式學生：沒有信箱，而是透過 parentId 綁定 demo 家長
  const demoChildren = await prisma.childProfile.findMany({
    where: {
      OR: [
        { email: { contains: '@demo.com' } },
        { parentId: { in: demoUserIds } },
      ],
    },
    select: { id: true, nickname: true },
  })

  if (demoUsers.length === 0 && demoChildren.length === 0) {
    console.log('✅ 資料庫中沒有任何 demo 資料，無需清理。')
    return
  }

  const demoChildIds = demoChildren.map((c) => c.id)

  // 統計即將連帶刪除的關聯資料
  const [sessions, attempts, mastery, badges] = await Promise.all([
    prisma.practiceSession.count({ where: { childId: { in: demoChildIds } } }),
    prisma.attempt.count({
      where: { session: { childId: { in: demoChildIds } } },
    }),
    prisma.masterySnapshot.count({ where: { childId: { in: demoChildIds } } }),
    prisma.childBadge.count({ where: { childId: { in: demoChildIds } } }),
  ])

  console.log('即將刪除：')
  console.log(`  • 家長帳號: ${demoUsers.length} 個`)
  for (const u of demoUsers) {
    console.log(`      - ${u.name} (${u.email})`)
  }
  console.log(`  • 孩子檔案: ${demoChildren.length} 個`)
  for (const c of demoChildren) {
    console.log(`      - ${c.nickname}`)
  }
  console.log(`  • 連帶刪除（cascade）：${sessions} 個會話 / ${attempts} 次答題 / ${mastery} 條掌握度 / ${badges} 個徽章\n`)

  // ---------- 執行刪除 ----------
  // 順序很重要：先刪孩子檔案（cascade 清掉 sessions/attempts/mastery/badges），
  // 再刪家長帳號。ParentChild 紀錄也會因 cascade 一併清除。
  if (demoChildIds.length > 0) {
    await prisma.childProfile.deleteMany({ where: { id: { in: demoChildIds } } })
  }
  if (demoUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: demoUserIds } } })
  }

  console.log('✅ 清除完成！')
  console.log(`   已刪除 ${demoUsers.length} 個 demo 家長、${demoChildren.length} 個 demo 孩子`)
}

main()
  .catch((e) => {
    console.error('❌ 清除失敗：', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
