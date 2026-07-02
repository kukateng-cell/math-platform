import Link from 'next/link'
import { getCurrentUser } from '@/actions/auth'

export default async function Home() {
  const user = await getCurrentUser()

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
      <div className="max-w-2xl">
        <div className="mb-4 text-6xl">🔢</div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight sm:text-5xl">
          數學小達人
        </h1>
        <p className="mb-8 text-lg text-neutral-600">
          陪伴 K-2 孩子建立扎實的數感與計算基礎。
          家長建立孩子檔案，孩子輕鬆做題，系統記錄表現並給出下一步建議。
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {user ? (
            <Link
              href={user.role === 'ADMIN' ? '/admin' : '/dashboard'}
              className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700"
            >
              進入平台 →
            </Link>
          ) : (
            <>
              <Link
                href="/signup"
                className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700"
              >
                家長免費開始
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-neutral-300 px-6 py-3 font-medium transition hover:bg-neutral-50"
              >
                家長登入
              </Link>
            </>
          )}
        </div>

        {/* 學生自主學習入口 */}
        {!user && (
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm">
            <span className="text-green-800">🌱 我是學生，想自己練習</span>
            <Link href="/student/signup" className="font-medium text-green-700 underline-offset-2 hover:underline">
              學生註冊
            </Link>
            <span className="text-green-300">·</span>
            <Link href="/student/login" className="font-medium text-green-700 underline-offset-2 hover:underline">
              學生登入
            </Link>
          </div>
        )}
      </div>

      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-3">
        {[
          { icon: '👤', title: '建立孩子檔案', desc: '一個家長帳號可管理多個孩子' },
          { icon: '✏️', title: '趣味做題', desc: '每次 8-12 題，即時回饋' },
          { icon: '📊', title: '掌握度追蹤', desc: '規則式推薦，家長看得懂' },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-neutral-200 bg-white p-5 text-left shadow-sm"
          >
            <div className="mb-2 text-2xl">{f.icon}</div>
            <h3 className="mb-1 font-semibold">{f.title}</h3>
            <p className="text-sm text-neutral-600">{f.desc}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
