import Link from 'next/link'
import { createCaptcha } from '@/lib/captcha'
import LoginForm from '@/components/login-form'

export default async function LoginPage() {
  const captcha = await createCaptcha()

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">家長登入</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-gray-300">登入繼續孩子的學習</p>
        </div>
        <LoginForm initialCaptcha={captcha} />
        <p className="mt-6 text-center text-sm text-neutral-600 dark:text-gray-300">
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
