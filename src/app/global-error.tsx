'use client'

// 全域錯誤邊界：捕獲任何未處理的 Server Component / Client Component 錯誤，
// 避免畫面只剩 layout 外殼（空白頁）。使用者在出錯時可點擊「重試」重新載入。
// 注意：此元件會完全取代 root layout，因此需自備 <html>/<body> 及 CSS。

import { useEffect } from 'react'
import './globals.css'

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error('GlobalError caught:', error)
  }, [error])

  return (
    <html lang="zh-Hant">
      <body className="min-h-full bg-white dark:bg-gray-950">
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="text-6xl">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            頁面載入失敗
          </h1>
          <p className="max-w-md text-neutral-500 dark:text-gray-400">
            系統暫時無法處理這個請求，請檢查網路連線後再試一次。
            {error.digest && (
              <span className="mt-2 block text-xs text-neutral-400">
                錯誤代碼：{error.digest}
              </span>
            )}
          </p>
          <button
            onClick={reset}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            重試
          </button>
        </main>
      </body>
    </html>
  )
}
