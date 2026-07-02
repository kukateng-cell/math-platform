'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { logout } from '@/actions/auth'

type Props = {
  user: {
    primary: { href: string; label: string }
    name: string
    role: string
  } | null
}

export default function MobileMenu({ user }: Props) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // 點擊外部關閉選單
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick)
      // 鎖定背景滾動
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-neutral-100 dark:hover:bg-gray-800"
        aria-label="選單"
      >
        <svg
          className="h-5 w-5 text-neutral-700 dark:text-neutral-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {open ? (
            <path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {open && (
        <>
          {/* 半透明遮罩 */}
          <div className="fixed inset-0 -z-10 bg-black/20 backdrop-blur-sm" />

          {/* 選單面板 */}
          <div className="absolute right-0 top-2 z-50 w-60 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            {user ? (
              <div className="divide-y divide-neutral-100 dark:divide-gray-800">
                <div className="px-4 py-3">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">{user.name}</p>
                  <p className="text-xs text-neutral-500 dark:text-gray-400">
                    {user.role === 'ADMIN' ? '管理員' : '家長'}
                  </p>
                </div>
                <div className="py-1">
                  <Link
                    href={user.primary.href}
                    onClick={() => setOpen(false)}
                    className="flex px-4 py-2.5 text-sm text-neutral-700 transition hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-gray-800"
                  >
                    {user.primary.label}
                  </Link>
                  {user.role !== 'ADMIN' && (
                    <Link
                      href="/dashboard"
                      onClick={() => setOpen(false)}
                      className="flex px-4 py-2.5 text-sm text-neutral-700 transition hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-gray-800"
                    >
                      我的孩子
                    </Link>
                  )}
                </div>
                <div className="py-1">
                  <form
                    action={async () => {
                      setOpen(false)
                      await logout()
                    }}
                  >
                    <button
                      type="submit"
                      className="flex w-full px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      登出
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 py-1 dark:divide-gray-800">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex px-4 py-2.5 text-sm text-neutral-700 transition hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-gray-800"
                >
                  家長登入
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="flex px-4 py-2.5 text-sm font-medium text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
                >
                  家長註冊
                </Link>
                <Link
                  href="/student/login"
                  onClick={() => setOpen(false)}
                  className="flex px-4 py-2.5 text-sm text-neutral-700 transition hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-gray-800"
                >
                  🧑‍🎓 學生登入
                </Link>
                <Link
                  href="/student/signup"
                  onClick={() => setOpen(false)}
                  className="flex px-4 py-2.5 text-sm font-medium text-green-600 transition hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
                >
                  🌱 學生註冊
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
