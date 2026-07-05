import Link from 'next/link'
import { createCaptcha } from '@/lib/captcha'
import ForgotPasswordForm from '@/components/forgot-password-form'

export default async function ForgotPasswordPage() {
  const captcha = await createCaptcha()

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-slate-500 via-indigo-600 to-blue-700 p-4">
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
          <div className="mb-3 text-5xl">🔑</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">忘記密碼</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            輸入 Email，我們會寄送驗證碼協助您重設密碼
          </p>
        </div>
        <ForgotPasswordForm initialCaptcha={captcha} />
        <p className="mt-6 text-center text-sm text-neutral-600 dark:text-gray-300">
          想起密碼了？{' '}
          <Link
            href="/login"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            返回登入
          </Link>
        </p>
      </div>
    </main>
  )
}
