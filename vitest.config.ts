import { defineConfig } from 'vitest/config'
import path from 'node:path'

// ============ Vitest 設定 ============
// 單元測試用於驗證純邏輯模組（不涉及 DB / Next.js 執行期）。
// 整合測試（integration/）需要 PostgreSQL，僅在 DATABASE_URL 存在時執行。
//
// 命名慣例：
//   src/lib/__tests__/*.test.ts        — 純邏輯單元測試
//   src/lib/__tests__/integration/*.test.ts — DB 整合測試
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 是否啟用 DB 整合測試
const hasTestDb = !!process.env.DATABASE_URL

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: hasTestDb
      ? ['src/**/*.test.ts']
      : ['src/lib/__tests__/*.test.ts'],
    exclude: ['src/lib/__tests__/helpers/**'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
