import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Prisma 7: datasource.url 不可寫在 schema，連線字串放這裡
// prisma.config.ts 是 CLI 設定（migrate / db push / seed）→ 用 DIRECT_URL（port 5432 非 pooled）
// runtime 連線在 src/lib/prisma.ts → 用 DATABASE_URL（port 6543 pooled）
// DIRECT_URL 沒設定時降級到 DATABASE_URL，避免開發環境忘記設就 crash
export default defineConfig({
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
  migrations: {
    seed: 'node --experimental-strip-types prisma/seed.ts',
  },
  schema: 'prisma/schema.prisma',
})