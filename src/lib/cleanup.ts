import 'server-only'
import { prisma } from '@/lib/prisma'
import { cleanupExpiredRateLimits } from '@/lib/rate-limit'
import { cleanupExpiredCaptchas } from '@/lib/captcha'

// ====================================================================
// 臨時認證資料清理（P2-10）
// --------------------------------------------------------------------
// 具有時效性的資料表若不定期清理，會持續累積：
//   - OtpCode              ：expiresAt 過期（lazy delete 只覆蓋被存取者）
//   - PendingSignup        ：expiresAt 過期
//   - PasswordResetGrant   ：consumedAt 已消耗 / 過期未使用
//   - RateLimit            ：resetAt 窗口已過（已有 cleanup 函式但無人呼叫）
//   - CAPTCHA Map（記憶體） ：token 已過期但 Map entry 永不釋放（記憶體洩漏）
//
// 本模組提供：
//   - 每張表的獨立清理函式（回傳刪除筆數）
//   - cleanupAuthTempData() 統一協調，單張表失敗不影響其他表
//
// 觸發方式：
//   - Vercel Cron：GET/POST /api/cron/cleanup（每小時，CRON_SECRET 鑑權）
//   - CLI / CI   ：npm run cleanup:auth（scripts/cleanup-auth-data.ts）
//
// 索引：所有清理查詢都走既有 index，避免全表掃描：
//   - OtpCode.@@index([expiresAt])
//   - PendingSignup.@@index([expiresAt])
//   - PasswordResetGrant.@@index([consumedAt]) / .@@index([createdAt])
//   - RateLimit.@@index([resetAt])
// ====================================================================

// 密碼重設 grant 清理保留期：
//   - 已消耗（consumedAt != null）：保留 1 小時，避免與進行中的重設流程競爭
//   - 過期未消耗（outstanding）：tempToken 壽命 10 分鐘，超過 24 小時必屬陳舊
const GRANT_CONSUMED_RETENTION_MS = 60 * 60 * 1000 // 1 小時
const GRANT_STALE_MS = 24 * 60 * 60 * 1000 // 24 小時

export type CleanupResult = {
  otp: number
  pendingSignups: number
  passwordResetGrants: number
  rateLimits: number
  captchas: number
  errors: string[]
}

/** 清理已過期的 OTP（expiresAt < now）。 */
export async function cleanupExpiredOtp(now = new Date()): Promise<number> {
  const result = await prisma.otpCode.deleteMany({
    where: { expiresAt: { lt: now } },
  })
  return result.count
}

/** 清理已過期的註冊暫存（expiresAt < now）。 */
export async function cleanupExpiredPendingSignups(now = new Date()): Promise<number> {
  const result = await prisma.pendingSignup.deleteMany({
    where: { expiresAt: { lt: now } },
  })
  return result.count
}

/**
 * 清理密碼重設授權：
 *   1. 已消耗（consumedAt 非 null）且超過保留期 → 刪除
 *   2. 過期未消耗（outstanding）且超過陳舊門檻 → 刪除
 *
 * 已消耗的 grant 唯一作用是防重放；消耗後即無用，可安全刪除。
 * 未消耗的 grant 搭配 10 分鐘壽命的 tempToken，超過 24h 必為陳舊資料。
 */
export async function cleanupPasswordResetGrants(now = new Date()): Promise<number> {
  const consumedBefore = new Date(now.getTime() - GRANT_CONSUMED_RETENTION_MS)
  const staleBefore = new Date(now.getTime() - GRANT_STALE_MS)

  // 已消耗且超過保留期
  const consumed = await prisma.passwordResetGrant.deleteMany({
    where: { consumedAt: { lt: consumedBefore } },
  })
  // 過期未消耗且陳舊
  const stale = await prisma.passwordResetGrant.deleteMany({
    where: {
      AND: [{ consumedAt: null }, { createdAt: { lt: staleBefore } }],
    },
  })

  return consumed.count + stale.count
}

/**
 * 統一清理所有臨時認證資料。
 * 每張表獨立 try/catch：單張表失敗不中斷其餘清理。
 * 回傳各表刪除筆數與任何錯誤訊息。
 */
export async function cleanupAuthTempData(now = new Date()): Promise<CleanupResult> {
  const result: CleanupResult = {
    otp: 0,
    pendingSignups: 0,
    passwordResetGrants: 0,
    rateLimits: 0,
    captchas: 0,
    errors: [],
  }

  // OTP
  try {
    result.otp = await cleanupExpiredOtp(now)
  } catch (e) {
    result.errors.push(`OTP: ${(e as Error).message}`)
  }

  // PendingSignup
  try {
    result.pendingSignups = await cleanupExpiredPendingSignups(now)
  } catch (e) {
    result.errors.push(`PendingSignup: ${(e as Error).message}`)
  }

  // PasswordResetGrant
  try {
    result.passwordResetGrants = await cleanupPasswordResetGrants(now)
  } catch (e) {
    result.errors.push(`PasswordResetGrant: ${(e as Error).message}`)
  }

  // RateLimit（內含記憶體備援清理，回傳刪除筆數）
  try {
    result.rateLimits = await cleanupExpiredRateLimits()
  } catch (e) {
    result.errors.push(`RateLimit: ${(e as Error).message}`)
  }

  // CAPTCHA Map（記憶體）
  try {
    result.captchas = cleanupExpiredCaptchas()
  } catch (e) {
    result.errors.push(`CAPTCHA: ${(e as Error).message}`)
  }

  return result
}
