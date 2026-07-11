#!/usr/bin/env node
// ============================================================================
// 臨時認證資料清理 CLI（P2-10）
// ----------------------------------------------------------------------------
// 清理已過期 / 已消耗的臨時認證資料，供手動執行或 CI 排程使用。
// 邏輯與 src/lib/cleanup.ts 一致（DB 部分）；cron 端點 /api/cron/cleanup
// 另外會清理記憶體中的 CAPTCHA Map（CLI 屬獨立 process，無法清理 server 記憶體）。
//
// 執行：npm run cleanup:auth
//   或：node --experimental-strip-types scripts/cleanup-auth-data.ts
//
// 清理對象：
//   - OtpCode              ：expiresAt < now
//   - PendingSignup        ：expiresAt < now
//   - PasswordResetGrant   ：consumedAt 已消耗（>1h）/ 陳舊未消耗（>24h）
//   - RateLimit            ：resetAt < now
// ============================================================================

import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set')
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// 保留期（與 src/lib/cleanup.ts 保持一致）
const GRANT_CONSUMED_RETENTION_MS = 60 * 60 * 1000 // 已消耗 grant 保留 1 小時
const GRANT_STALE_MS = 24 * 60 * 60 * 1000 // 未消耗 grant 陳舊門檻 24 小時

async function main() {
  const now = new Date()
  const startedAt = now.toISOString()
  console.log(`🧹 開始清理臨時認證資料（${startedAt}）...\n`)

  // 1. 過期 OTP
  const otp = await prisma.otpCode.deleteMany({ where: { expiresAt: { lt: now } } })

  // 2. 過期 PendingSignup
  const pending = await prisma.pendingSignup.deleteMany({
    where: { expiresAt: { lt: now } },
  })

  // 3. PasswordResetGrant：已消耗（>1h）+ 陳舊未消耗（>24h）
  const consumedBefore = new Date(now.getTime() - GRANT_CONSUMED_RETENTION_MS)
  const staleBefore = new Date(now.getTime() - GRANT_STALE_MS)
  const grantsConsumed = await prisma.passwordResetGrant.deleteMany({
    where: { consumedAt: { lt: consumedBefore } },
  })
  const grantsStale = await prisma.passwordResetGrant.deleteMany({
    where: { AND: [{ consumedAt: null }, { createdAt: { lt: staleBefore } }] },
  })

  // 4. 過期 RateLimit
  const rateLimits = await prisma.rateLimit.deleteMany({
    where: { resetAt: { lt: now } },
  })

  console.log('✅ 清理完成：')
  console.log(`   OtpCode              : ${otp.count} 筆`)
  console.log(`   PendingSignup        : ${pending.count} 筆`)
  console.log(
    `   PasswordResetGrant   : ${grantsConsumed.count + grantsStale.count} 筆` +
      `（已消耗 ${grantsConsumed.count} / 陳舊未用 ${grantsStale.count}）`
  )
  console.log(`   RateLimit            : ${rateLimits.count} 筆`)
  console.log(`\n⏱️  完成於 ${new Date().toISOString()}`)
  console.log('ℹ️  CAPTCHA Map 為 server 記憶體資料，請透過 /api/cron/cleanup 清理')
}

main()
  .catch((e) => {
    console.error('❌ 清理失敗：', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
