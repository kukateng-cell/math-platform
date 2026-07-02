import Link from 'next/link'
import { getCurrentUser, logout } from '@/actions/auth'
import ReducedMotionToggle from './reduced-motion-toggle'

export default async function Header() {
  const user = await getCurrentUser()

  return (
    <header className="border-b border-neutral-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold dark:text-white">
          <span className="text-xl">🔢</span>
          <span>數學小達人</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <ReducedMotionToggle />
          {user ? (
            <>
              {user.role === 'ADMIN' ? (
                <Link href="/admin" className="text-neutral-600 hover:text-neutral-900 dark:text-gray-300 dark:hover:text-white">
                  管理後台
                </Link>
              ) : (
                <Link href="/dashboard" className="text-neutral-600 hover:text-neutral-900 dark:text-gray-300 dark:hover:text-white">
                  我的孩子
                </Link>
              )}
              <span className="text-neutral-400 dark:text-gray-400">{user.name}</span>
              <form action={logout}>
                <button type="submit" className="text-neutral-500 hover:text-neutral-900 dark:text-gray-400 dark:hover:text-white">
                  登出
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/student/login" className="text-neutral-500 hover:text-neutral-700 dark:text-gray-400 dark:hover:text-gray-200">
                🧑‍🎓 學生登入
              </Link>
              <Link href="/login" className="text-neutral-600 hover:text-neutral-900 dark:text-gray-300 dark:hover:text-white">
                家長登入
              </Link>
              <Link
                href="/student/signup"
                className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 font-medium text-green-700 hover:bg-green-100"
              >
                🌱 學生註冊
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
              >
                家長註冊
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
