import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Prisma 7: datasource.url 不可寫在 schema，連線字串放這裡
// 開發用 Supabase connection string（見 .env）
// prisma migrate/CLI 用「非 pooled」連線（DIRECT_URL, port 5432），避免 schema 變更衝突
export default defineConfig({
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
  migrations: {
    seed: 'node --experimental-strip-types prisma/seed.ts',
  },
  schema: 'prisma/schema.prisma',
})
