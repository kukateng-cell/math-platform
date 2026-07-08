import { defineConfig } from 'vitest/config'
import path from 'node:path'

// ============ Vitest 設定 ============
// 單元測試用於驗證純邏輯模組（不涉及 DB / Next.js 執行期）。
// 目前覆蓋：grade.ts（年級順序/權限）、answer-i18n.ts（答案等價比對）。
//
// 命名慣例：測試檔放在 src/lib/__tests__/ 下，檔名 *.test.ts。
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      // 與 tsconfig.json 的 paths 對齊，讓測試也能用 @/ 匯入
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // 只測 src 下的單元，避免誤抓 node_modules / .next
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
