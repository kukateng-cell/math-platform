// 儀表板載入中的骨架畫面
// 點擊「我的孩子」後立即顯示此畫面，避免使用者覺得「卡住了」，
// 同時伺服器在背景並行抓取孩子列表與綁定請求。
export default function DashboardLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <div className="mb-6">
        <div className="h-8 w-48 animate-pulse rounded bg-neutral-200 dark:bg-gray-700" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-neutral-200 dark:bg-gray-700" />
      </div>
      {/* 模擬孩子卡片的骨架 */}
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-2xl border border-neutral-200 bg-white dark:border-gray-700 dark:bg-gray-900"
          />
        ))}
      </div>
    </main>
  )
}
