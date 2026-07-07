import 'server-only'
import { prisma } from '@/lib/prisma'

// ============ 限速器（持久化於 DB，替代記憶體 Map）============
// serverless / 多 instance 環境下，記憶體 Map 的計數各 instance 獨立，
// 攻擊者可透過反覆觸發冷啟動繞過限速。改用 DB 計數確保跨 instance 一致。
//
// 用法：checkRateLimit('login:alice@example.com', 5, 60_000)
// key 帶場景前綴避免不同操作共用計數。

type RateLimitResult = { allowed: boolean; remaining: number; resetAt: Date }

// 檢查並計數：若在窗口內未超過 max 則計數 +1 回傳 allowed=true
export async function checkRateLimit(
  key: string,
  max = 5,
  windowMs = 60_000
): Promise<boolean> {
  const result = await consumeRateLimit(key, max, windowMs)
  return result.allowed
}

// 檢查並計數，回傳詳細資訊（剩餘次數、重置時間）
export async function consumeRateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = new Date()
  const resetAt = new Date(now.getTime() + windowMs)

  // 嘗試讀取現有記錄
  const existing = await prisma.rateLimit.findUnique({ where: { key } })

  if (!existing || now > existing.resetAt) {
    // 無記錄或窗口已過期 → 重置計數
    await prisma.rateLimit.upsert({
      where: { key },
      update: { count: 1, resetAt },
      create: { key, count: 1, resetAt },
    })
    return { allowed: true, remaining: max - 1, resetAt }
  }

  // 窗口內：累加計數
  const newCount = existing.count + 1
  const allowed = newCount <= max
  await prisma.rateLimit.update({
    where: { key },
    data: { count: newCount },
  })
  return { allowed, remaining: Math.max(0, max - newCount), resetAt: existing.resetAt }
}

// 清理過期的限速記錄（可由定時任務順帶呼叫）
export async function cleanupExpiredRateLimits(): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } })
}
