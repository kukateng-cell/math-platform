import 'server-only'
import { prisma } from '@/lib/prisma'

// ============ 限速器（優先使用 DB，降級至記憶體 Map）============
// serverless / 多 instance 環境下建議用 DB 確保全域一致。
// 若 RateLimit 表尚未建立（Supabase pooler 無法執行 DDL），
// 自動降級至記憶體 Map，確保功能不受阻。
//
// 用法：checkRateLimit('login:alice@example.com', 5, 60_000)
// key 帶場景前綴避免不同操作共用計數。

type RateLimitResult = { allowed: boolean; remaining: number; resetAt: Date }

// 記憶體備援
const memoryStore = new Map<string, { count: number; resetAt: number }>()

let dbAvailable: boolean | null = null

async function isDbAvailable(): Promise<boolean> {
  if (dbAvailable !== null) return dbAvailable
  try {
    await prisma.rateLimit.findFirst()
    dbAvailable = true
  } catch {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[RateLimit] DB table not available in production')
    }
    console.warn('[RateLimit] DB table not available, falling back to in-memory')
    dbAvailable = false
  }
  return dbAvailable
}

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
  // 嘗試使用 DB；若表不存在則使用記憶體備援
  if (await isDbAvailable()) {
    try {
      return await dbConsumeRateLimit(key, max, windowMs)
    } catch {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('[RateLimit] DB operation failed in production')
      }
      dbAvailable = null // 下次重試
    }
  }

  // 記憶體備援（僅開發模式）
  return memoryConsumeRateLimit(key, max, windowMs)
}

async function dbConsumeRateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = new Date()

  // P2-12：先用原子 updateMany 嘗試遞增（僅當窗口未過期時），
  // 避免先讀後寫（findUnique → upsert）的窗口重置競態。
  const result = await prisma.rateLimit.updateMany({
    where: { key, resetAt: { gt: now } },
    data: { count: { increment: 1 } },
  })

  if (result.count > 0) {
    // 窗口內正常計數成功
    const row = await prisma.rateLimit.findUniqueOrThrow({ where: { key } })
    const allowed = row.count <= max
    return { allowed, remaining: Math.max(0, max - row.count), resetAt: row.resetAt }
  }

  // 窗口已過期或不存在 → 用 upsert 原子性重設。
  // 兩個併發請求可能都進入此分支，但 upsert 的 unique key 確保
  // 最終只有一個 count=1、一個 resetAt；少計一筆在 rate limit 場景可接受。
  const row = await prisma.rateLimit.upsert({
    where: { key },
    update: { count: 1, resetAt: new Date(now.getTime() + windowMs) },
    create: { key, count: 1, resetAt: new Date(now.getTime() + windowMs) },
  })
  return { allowed: true, remaining: max - 1, resetAt: row.resetAt }
}

function memoryConsumeRateLimit(
  key: string,
  max: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const resetAt = new Date(now + windowMs)
  const entry = memoryStore.get(key)

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: max - 1, resetAt }
  }

  entry.count++
  return { allowed: entry.count <= max, remaining: Math.max(0, max - entry.count), resetAt: new Date(entry.resetAt) }
}

// 清理過期的限速記錄。回傳已刪除筆數（DB + 記憶體）。
export async function cleanupExpiredRateLimits(): Promise<number> {
  let deleted = 0
  if (await isDbAvailable()) {
    try {
      const result = await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } })
      deleted += result.count
    } catch {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('[RateLimit] DB cleanup failed in production')
      }
    }
  }
  const now = Date.now()
  for (const [key, entry] of memoryStore) {
    if (now > entry.resetAt) {
      memoryStore.delete(key)
      deleted++
    }
  }
  return deleted
}
