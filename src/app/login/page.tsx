import Link from 'next/link'
import { createCaptcha } from '@/lib/captcha'
import LoginForm from '@/components/login-form'

export default async function LoginPage() {
  const captcha = await createCaptcha()

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-500 via-blue-600 to-purple-700 p-4">
      {/* 漂浮數學符號裝飾 */}
      <div className="pointer-events-none absolute inset-0 select-none opacity-20" aria-hidden="true">
        <div className="absolute left-[8%] top-[12%] text-8xl">➕</div>
        <div className="absolute right-[10%] top-[22%] text-7xl">✖️</div>
        <div className="absolute bottom-[14%] left-[18%] text-6xl">➗</div>
        <div className="absolute right-[16%] bottom-[10%] text-8xl">🔢</div>
        <div className="absolute left-[44%] top-[6%] text-5xl">⭐</div>
      </div>
      <div className="relative w-full max-w-sm rounded-3xl bg-white/95 p-8 shadow-2xl ring-1 ring-black/5 backdrop-blur-sm dark:bg-gray-900/95 sm:p-10">
        <div className="mb-6 text-center">
          <div className="mb-3 text-5xl">🔢</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">歡迎回來</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">家長登入 · 繼續孩子的學習</p>
        </div>
        <LoginForm initialCaptcha={captcha} />
        <p className="mt-4 text-right text-sm">
          <Link href="/forgot-password" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
            忘記密碼？
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-neutral-600 dark:text-gray-300">
          還沒有帳號？{' '}
          <Link href="/signup" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
            家長註冊
          </Link>
        </p>
        {/* 其他登入方式 */}
        <div className="mt-4 space-y-2 border-t border-neutral-200 pt-4 text-center text-sm dark:border-gray-700">
          <p className="text-neutral-500 dark:text-gray-400">其他登入方式：</p>
          <Link href="/student/login" className="block rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 font-medium text-green-700 transition hover:bg-green-100 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
            🌱 學生登入（Email + 驗證碼）
          </Link>
        </div>
      </div>
    </main>
  )
}
