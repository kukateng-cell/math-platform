// 孩子檔案載入中的骨架畫面
// 點擊孩子後立即顯示，避免空白等待。
export default function ChildOverviewLoading() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <div className="h-4 w-32 animate-pulse rounded bg-neutral-200 dark:bg-gray-700" />
      {/* 孩子資訊列骨架 */}
      <div className="mt-3 mb-8 flex items-center gap-4">
        <div className="h-16 w-16 animate-pulse rounded-2xl bg-neutral-200 dark:bg-gray-700" />
        <div className="flex-1 space-y-2">
          <div className="h-6 w-32 animate-pulse rounded bg-neutral-200 dark:bg-gray-700" />
          <div className="h-4 w-48 animate-pulse rounded bg-neutral-200 dark:bg-gray-700" />
        </div>
      </div>
      {/* 技能掌握度骨架 */}
      <div className="mb-10 space-y-3">
        <div className="h-5 w-28 animate-pulse rounded bg-neutral-200 dark:bg-gray-700" />
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-2xl border border-neutral-200 bg-white dark:border-gray-700 dark:bg-gray-900"
          />
        ))}
      </div>
    </main>
  )
}
