import Link from 'next/link'
import { createCaptcha } from '@/lib/captcha'
import SignupForm from '@/components/signup-form'
import AnimatedBackground from '@/components/animated-background'

export default async function SignupPage() {
  const captcha = await createCaptcha()

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
      <AnimatedBackground
        gradient="from-emerald-500 via-teal-600 to-blue-700"
        blobColors={["bg-teal-400/30", "bg-emerald-400/30", "bg-blue-400/30"]}
      />
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
