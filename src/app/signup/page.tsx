import Link from 'next/link'
import { createCaptcha } from '@/lib/captcha'
import SignupForm from '@/components/signup-form'

export default async function SignupPage() {
  const captcha = await createCaptcha()

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-600 to-blue-700 p-4">
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
          <div className="mb-3 text-5xl">🌱</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">建立家長帳號</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            註冊後即可為孩子建立學習檔案
          </p>
        </div>
        <SignupForm initialCaptcha={captcha} />
        <p className="mt-6 text-center text-sm text-neutral-600 dark:text-gray-300">
          已經有帳號了？{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
            登入
          </Link>
        </p>
        {/* 學生自主學習入口 */}
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-center text-sm">
          <span className="text-green-800">🌱 我是學生，想自己練習？</span>{' '}
          <Link href="/student/signup" className="font-medium text-green-700 hover:underline">
            學生註冊 →
          </Link>
        </div>
      </div>
    </main>
  )
}
