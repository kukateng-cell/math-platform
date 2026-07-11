// 登入頁載入中狀態：Server Component 仍在渲染（例如 createCaptcha / DB 連線）
// 避免冷啟動時使用者看到空白頁，至少顯示載入動畫回饋。
export default function Loading() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <p className="text-sm text-neutral-500 dark:text-gray-400">載入中…</p>
      </div>
    </main>
  )
}
