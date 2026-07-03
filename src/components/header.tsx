import Link from 'next/link'
import { getCurrentUser, logout } from '@/actions/auth'
import ReducedMotionToggle from './reduced-motion-toggle'
import ThemeToggle from './theme-toggle'

export default async function Header() {
  const user = await getCurrentUser()

  return (
    <header className="border-b border-neutral-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-bold dark:text-white">
          <span className="text-xl">🔢</span>
          <span className="hidden sm:inline">數學小達人</span>
        </Link>
        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto text-xs sm:gap-3 sm:text-sm [&::-webkit-scrollbar]:hidden">
          <ThemeToggle />
          <ReducedMotionToggle />
          {user ? (
            <>
              {user.role === 'ADMIN' ? (
                <Link href="/admin" className="whitespace-nowrap rounded-md px-2 py-1 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white">
                  管理後台
                </Link>
              ) : (
                <Link href="/dashboard" className="whitespace-nowrap rounded-md px-2 py-1 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white">
                  我的孩子
                </Link>
              )}
              <span className="hidden truncate text-neutral-400 dark:text-gray-400 sm:inline">{user.name}</span>
              <form action={logout}>
                <button type="submit" className="whitespace-nowrap rounded-md px-2 py-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white">
                  登出
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/student/login" className="whitespace-nowrap rounded-md px-2 py-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200">
                🧑‍🎓 登入
              </Link>
              <Link
                href="/student/signup"
                className="whitespace-nowrap rounded-md border border-green-300 bg-green-50 px-2 py-1 font-medium text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
              >
                🌱 註冊
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
