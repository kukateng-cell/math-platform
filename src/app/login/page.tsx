import Link from 'next/link'
import { createCaptcha } from '@/lib/captcha'
import LoginForm from '@/components/login-form'

export default async function LoginPage() {
  const captcha = await createCaptcha()

  return (
    <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm">
        <div className="mb-5 text-center sm:mb-6">
          <h1 className="text-xl font-bold sm:text-2xl">家長登入</h1>
          <p className="mt-1 text-xs text-neutral-600 dark:text-gray-300 sm:text-sm">登入繼續孩子的學習</p>
        </div>
        <LoginForm initialCaptcha={captcha} />
        <p className="mt-5 text-center text-xs text-neutral-600 dark:text-gray-300 sm:mt-6 sm:text-sm">
          還沒有帳號？{' '}
          <Link href="/signup" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
            家長註冊
          </Link>
        </p>
        {/* 其他登入方式 */}
        <div className="mt-3 space-y-2 border-t border-neutral-200 pt-3 text-center text-xs dark:border-gray-700 sm:mt-4 sm:pt-4 sm:text-sm">
          <p className="text-neutral-500 dark:text-gray-400">其他登入方式：</p>
          <Link
            href="/student/login"
            className="block rounded-lg border border-green-200 bg-green-50 px-3 py-2 font-medium text-green-700 transition hover:bg-green-100 dark:border-green-800 dark:bg-green-950 dark:text-green-300 sm:px-4 sm:py-2.5"
          >
            🌱 學生登入（Email + 驗證碼）
          </Link>
        </div>
      </div>
    </main>
  )
}
