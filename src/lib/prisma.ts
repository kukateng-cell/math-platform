import { PrismaClient } from '@/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import type { PoolConfig } from 'pg'

// Prisma 7 必須傳入 driver adapter
// runtime 用 Supabase pooled 連線（port 6543, PgBouncer 已做连线池管理）
const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL!,
  max: process.env.NODE_ENV === 'production' ? 10 : 3,   // 开发环境限制 3 条连线，防止 HMR 耗尽
  idleTimeoutMillis: 30000,                                // 30 秒闲置自动回收
  connectionTimeoutMillis: 10000,                          // 10 秒连线超时
}

// Prisma 7 必須傳入 driver adapter（不再用 datasource url 直連）
function createPrismaClient() {
  const adapter = new PrismaPg(poolConfig)
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development'
      ? ['warn', 'error']
      : ['error'],
  })
}

// 开发环境：将 PrismaClient 挂在 globalThis 上，避免 Turbopack HMR 每次重建新连线
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  /** 上一次 Prisma 实例，HMR 时主动断开旧连线 */
  _prevPrisma: PrismaClient | undefined
}

// HMR 重建前，断开旧实例的连线
if (globalForPrisma._prevPrisma && globalForPrisma._prevPrisma !== globalForPrisma.prisma) {
  globalForPrisma._prevPrisma.$disconnect().catch(() => {})
  globalForPrisma._prevPrisma = undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma._prevPrisma = globalForPrisma.prisma
  globalForPrisma.prisma = prisma
}
