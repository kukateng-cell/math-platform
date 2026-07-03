import Link from 'next/link'
import { createCaptcha } from '@/lib/captcha'
import ForgotPasswordForm from '@/components/forgot-password-form'

export default async function ForgotPasswordPage() {
  const captcha = await createCaptcha()

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">忘記密碼</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-gray-300">
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
