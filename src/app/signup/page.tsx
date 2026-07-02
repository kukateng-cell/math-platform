import Link from 'next/link'
import { createCaptcha } from '@/lib/captcha'
import SignupForm from '@/components/signup-form'

export default async function SignupPage() {
  const captcha = await createCaptcha()

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">建立家長帳號</h1>
          <p className="mt-1 text-sm text-neutral-600">
            註冊後即可為孩子建立學習檔案
          </p>
        </div>
        <SignupForm initialCaptcha={captcha} />
        <p className="mt-6 text-center text-sm text-neutral-600">
          已經有帳號了？{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:underline">
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
