import Link from 'next/link'
import { createCaptcha } from '@/lib/captcha'
import LoginForm from '@/components/login-form'
import AnimatedBackground from '@/components/animated-background'
import { Icon } from '@/components/icon'

export default async function LoginPage() {
  const captcha = await createCaptcha()

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
      <AnimatedBackground />
      <div className="relative w-full max-w-sm rounded-3xl bg-white/95 p-8 shadow-2xl ring-1 ring-black/5 backdrop-blur-sm dark:bg-gray-900/95 sm:p-10">
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center text-blue-600 dark:text-blue-400"><Icon name="calculator" className="h-12 w-12" /></div>
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
          <Link href="/student/login" className="flex items-center justify-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 font-medium text-green-700 transition hover:bg-green-100 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
            <Icon name="sprout" className="h-4 w-4" />學生登入（Email + 驗證碼）
          </Link>
        </div>
      </div>
    </main>
  )
}
