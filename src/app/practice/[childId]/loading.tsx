// 練習選單載入中的骨架畫面
// 點擊「開始練習」後立即顯示，避免空白等待；伺服器在背景抓取技能樹、徽章、斷點續做。
export default function PracticeLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 lg:max-w-4xl">
      <div className="mb-6">
        <div className="h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-gray-700" />
        <div className="mt-2 h-8 w-56 animate-pulse rounded bg-neutral-200 dark:bg-gray-700" />
      </div>
      {/* 推薦區骨架 */}
      <div className="mb-6 h-20 animate-pulse rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950" />
      {/* 技能樹骨架 */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-2xl border border-neutral-200 bg-white dark:border-gray-700 dark:bg-gray-900"
          />
        ))}
      </div>
    </main>
  )
}
