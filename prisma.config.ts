import path from 'node:path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  // Prisma 7: migrate / cli 用的連線字串改放這裡
  // 用實體檔案路徑，避免相對路徑在不同 cwd 下找不到
  datasource: {
    url: `file:${path.join(process.cwd(), 'prisma', 'dev.db')}`,
  },
  migrations: {
    seed: 'node --experimental-strip-types prisma/seed.ts',
  },
  schema: 'prisma/schema.prisma',
})
