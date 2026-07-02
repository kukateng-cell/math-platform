import Link from 'next/link'
import { createCaptcha } from '@/lib/captcha'
import SignupForm from '@/components/signup-form'

export default async function SignupPage() {
  const captcha = await createCaptcha()

  return (
    <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm">
        <div className="mb-5 text-center sm:mb-6">
          <h1 className="text-xl font-bold sm:text-2xl">建立家長帳號</h1>
          <p className="mt-1 text-xs text-neutral-600 dark:text-gray-300 sm:text-sm">
            註冊後即可為孩子建立學習檔案
          </p>
        </div>
        <SignupForm initialCaptcha={captcha} />
        <p className="mt-5 text-center text-xs text-neutral-600 dark:text-gray-300 sm:mt-6 sm:text-sm">
          已經有帳號了？{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
            登入
          </Link>
        </p>
        {/* 學生自主學習入口 */}
        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-center text-xs dark:border-green-800 dark:bg-green-950 sm:mt-4 sm:text-sm">
          <span className="text-green-800 dark:text-green-300">🌱 我是學生，想自己練習？</span>{' '}
          <Link href="/student/signup" className="font-medium text-green-700 hover:underline dark:text-green-400">
            學生註冊 →
          </Link>
        </div>
      </div>
    </main>
  )
}
