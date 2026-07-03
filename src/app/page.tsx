import Link from 'next/link'
import { getCurrentUser } from '@/actions/auth'

export default async function Home() {
  const user = await getCurrentUser()

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-8 text-center sm:gap-8 sm:p-6">
      <div className="w-full max-w-2xl">
        <div className="mb-3 text-5xl sm:text-6xl">🔢</div>
        <h1 className="mb-2 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
          數學小達人
        </h1>
        <p className="mb-6 text-base text-neutral-600 dark:text-gray-300 sm:text-lg">
          陪伴 K-2 孩子建立扎實的數感與計算基礎。
          家長建立孩子檔案，孩子輕鬆做題，系統記錄表現並給出下一步建議。
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {user ? (
            <Link
              href={user.role === 'ADMIN' ? '/admin' : '/dashboard'}
              className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-700 sm:px-6 sm:py-3"
            >
              進入平台 →
            </Link>
          ) : (
            <>
              <Link
                href="/signup"
                className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-700 sm:px-6 sm:py-3"
              >
                家長免費開始
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center rounded-lg border border-neutral-300 px-5 py-2.5 font-medium transition hover:bg-neutral-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800 sm:px-6 sm:py-3"
              >
                家長登入
              </Link>
            </>
          )}
        </div>

        {/* 學生自主學習入口 */}
        {!user && (
          <div className="mx-auto mt-4 flex max-w-md flex-wrap items-center justify-center gap-x-2 gap-y-1.5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm dark:border-green-800 dark:bg-green-950">
            <span className="text-green-800 dark:text-green-300">🌱 我是學生，想自己練習</span>
            <Link href="/student/signup" className="font-medium text-green-700 underline-offset-2 hover:underline dark:text-green-400">
              學生註冊
            </Link>
            <span className="text-green-300 dark:text-green-600">·</span>
            <Link href="/student/login" className="font-medium text-green-700 underline-offset-2 hover:underline dark:text-green-400">
              學生登入
            </Link>
          </div>
        )}
      </div>

      <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-3 sm:gap-4">
        {[
          { icon: '👤', title: '建立孩子檔案', desc: '一個家長帳號可管理多個孩子' },
          { icon: '✏️', title: '趣味做題', desc: '每次 8-12 題，即時回饋' },
          { icon: '📊', title: '掌握度追蹤', desc: '規則式推薦，家長看得懂' },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-900 sm:p-5"
          >
            <div className="mb-1 text-2xl sm:mb-2">{f.icon}</div>
            <h3 className="mb-0.5 font-semibold sm:mb-1">{f.title}</h3>
            <p className="text-xs text-neutral-600 dark:text-gray-400 sm:text-sm">{f.desc}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
