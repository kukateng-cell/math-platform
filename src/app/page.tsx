import Link from 'next/link'
import { getCurrentUser } from '@/actions/auth'
import AnimatedBackground from '@/components/animated-background'

export default async function Home() {
  const user = await getCurrentUser()

  return (
    <main className="relative flex flex-1 flex-col items-center overflow-hidden px-4 py-10 text-center text-white sm:py-16">
      <AnimatedBackground />

      <div className="relative z-10 max-w-2xl">
        <div className="mb-4 text-7xl drop-shadow-lg">🔢</div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight drop-shadow sm:text-5xl">
          數學小達人
        </h1>
        <p className="mb-8 text-lg text-white/90 sm:text-xl">
          陪伴 K-2 孩子建立扎實的數感與計算基礎。
          家長建立孩子檔案，孩子輕鬆做題，系統記錄表現並給出下一步建議。
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {user ? (
            <Link
              href={user.role === 'ADMIN' ? '/admin' : '/dashboard'}
              className="rounded-xl bg-white px-6 py-3 font-bold text-blue-600 shadow-lg transition hover:bg-blue-50 active:scale-95"
            >
              進入平台 →
            </Link>
          ) : (
            <>
              <Link
                href="/signup"
                className="rounded-xl bg-white px-6 py-3 font-bold text-blue-600 shadow-lg transition hover:bg-blue-50 active:scale-95"
              >
                家長免費開始
              </Link>
              <Link
                href="/login"
                className="rounded-xl border-2 border-white/70 bg-white/10 px-6 py-3 font-bold text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
              >
                家長登入
              </Link>
            </>
          )}
        </div>

        {/* 學生自主學習入口 */}
        {!user && (
          <div className="mx-auto mt-6 flex max-w-md flex-wrap items-center justify-center gap-2 rounded-2xl bg-white/15 px-5 py-3 text-sm backdrop-blur-sm ring-1 ring-white/20">
            <span>🌱 我是學生，想自己練習</span>
            <Link href="/student/signup" className="font-bold underline-offset-2 hover:underline">
              學生註冊
            </Link>
            <span className="opacity-50">·</span>
            <Link href="/student/login" className="font-bold underline-offset-2 hover:underline">
              學生登入
            </Link>
          </div>
        )}
      </div>

      <div className="relative z-10 mt-12 grid w-full max-w-3xl gap-4 sm:grid-cols-3">
        {[
          { icon: '👤', title: '建立孩子檔案', desc: '一個家長帳號可管理多個孩子' },
          { icon: '✏️', title: '趣味做題', desc: '每次 8-12 題，即時回饋' },
          { icon: '📊', title: '掌握度追蹤', desc: '規則式推薦，家長看得懂' },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-2xl bg-white/95 p-5 text-left shadow-xl ring-1 ring-black/5 backdrop-blur-sm dark:bg-gray-900/95"
          >
            <div className="mb-2 text-3xl">{f.icon}</div>
            <h3 className="mb-1 font-bold text-gray-900 dark:text-white">{f.title}</h3>
            <p className="text-sm text-neutral-600 dark:text-gray-400">{f.desc}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
