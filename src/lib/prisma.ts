import { PrismaClient } from '@/generated/prisma/client.js'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import path from 'node:path'

// Prisma 7 必須傳入 driver adapter（不再用 datasource url 直連）
// 本地開發用 SQLite
function createPrismaClient() {
  const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` })
  return new PrismaClient({ adapter })
}

// 開發環境避免 HMR 重建連線造成耗盡（注意：改 schema/lib 後需 rm -rf .next 重啟）
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
