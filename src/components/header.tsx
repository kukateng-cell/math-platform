import Link from 'next/link'
import { getCurrentUser, logout } from '@/actions/auth'
import ReducedMotionToggle from './reduced-motion-toggle'
import MobileMenu from './mobile-menu'

export default async function Header() {
  const user = await getCurrentUser()

  const navLinks = user
    ? {
        primary: user.role === 'ADMIN'
          ? { href: '/admin', label: '管理後台' }
          : { href: '/dashboard', label: '我的孩子' },
        name: user.name ?? '',
        role: user.role,
      }
    : null

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/95">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold dark:text-white">
          <span className="text-xl">🔢</span>
          <span className="hidden xs:inline">數學小達人</span>
          <span className="xs:hidden">數學</span>
        </Link>

        {/* 桌機版導航 */}
        <nav className="hidden items-center gap-3 text-sm md:flex">
          <ReducedMotionToggle />
          {user ? (
            <>
              <Link
                href={navLinks!.primary.href}
                className="text-neutral-600 transition hover:text-neutral-900 dark:text-gray-300 dark:hover:text-white"
              >
                {navLinks!.primary.label}
              </Link>
              <span className="text-neutral-400 dark:text-gray-500">{navLinks!.name}</span>
              <form action={logout}>
                <button
                  type="submit"
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-neutral-600 transition hover:bg-neutral-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  登出
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/student/login"
                className="text-neutral-500 transition hover:text-neutral-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                🧑‍🎓 學生登入
              </Link>
              <Link
                href="/login"
                className="text-neutral-600 transition hover:text-neutral-900 dark:text-gray-300 dark:hover:text-white"
              >
                家長登入
              </Link>
              <Link
                href="/student/signup"
                className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 font-medium text-green-700 transition hover:bg-green-100 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
              >
                🌱 學生註冊
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white transition hover:bg-blue-700"
              >
                家長註冊
              </Link>
            </>
          )}
        </nav>

        {/* 手機版漢堡選單 */}
        <div className="flex items-center gap-2 md:hidden">
          <ReducedMotionToggle />
          <MobileMenu user={navLinks} />
        </div>
      </div>
    </header>
  )
}
