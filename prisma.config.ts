import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Prisma 7: datasource.url 不可寫在 schema，連線字串放這裡
// migrate / CLI 用 direct 連線（DIRECT_URL, port 5432）
// runtime 用 pooled 連線（DATABASE_URL, port 6543），見 src/lib/prisma.ts
export default defineConfig({
  datasource: {
    url: process.env.DIRECT_URL!,
  },
  migrations: {
    seed: 'node --experimental-strip-types prisma/seed.ts',
  },
  schema: 'prisma/schema.prisma',
})
