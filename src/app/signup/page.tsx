import Link from 'next/link'
import SignupForm from '@/components/signup-form'

export default function SignupPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">建立家長帳號</h1>
          <p className="mt-1 text-sm text-neutral-600">
            註冊後即可為孩子建立學習檔案
          </p>
        </div>
        <SignupForm />
        <p className="mt-6 text-center text-sm text-neutral-600">
          已經有帳號了？{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:underline">
            登入
          </Link>
        </p>
      </div>
    </main>
  )
}
