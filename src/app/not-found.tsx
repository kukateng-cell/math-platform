import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-6xl">🔍</div>
      <h1 className="text-2xl font-bold">頁面不存在</h1>
      <p className="text-neutral-500 dark:text-gray-400">找不到這個頁面，可能已被移除或網址有誤</p>
      <Link
        href="/dashboard"
        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        回到我的孩子
      </Link>
    </main>
  )
}
