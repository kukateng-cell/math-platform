import Link from 'next/link'
import { createCaptcha } from '@/lib/captcha'
import LoginForm from '@/components/login-form'

export default async function LoginPage() {
  const captcha = await createCaptcha()

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">歡迎回來</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-gray-300">登入繼續孩子的學習</p>
        </div>
        <LoginForm initialCaptcha={captcha} />
        <p className="mt-6 text-center text-sm text-neutral-600 dark:text-gray-300">
          還沒有帳號？{' '}
          <Link href="/signup" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
            註冊
          </Link>
        </p>
      </div>
    </main>
  )
}
