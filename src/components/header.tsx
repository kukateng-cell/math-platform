import Link from 'next/link'
import { getCurrentUser, logout } from '@/actions/auth'

export default async function Header() {
  const user = await getCurrentUser()

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="text-xl">🔢</span>
          <span>數學小達人</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              {user.role === 'ADMIN' ? (
                <Link href="/admin" className="text-neutral-600 hover:text-neutral-900">
                  管理後台
                </Link>
              ) : (
                <Link href="/dashboard" className="text-neutral-600 hover:text-neutral-900">
                  我的孩子
                </Link>
              )}
              <span className="text-neutral-400">{user.name}</span>
              <form action={logout}>
                <button type="submit" className="text-neutral-500 hover:text-neutral-900">
                  登出
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/child-login" className="text-neutral-500 hover:text-neutral-700">
                🧒 孩子練習
              </Link>
              <Link href="/login" className="text-neutral-600 hover:text-neutral-900">
                登入
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
              >
                註冊
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
