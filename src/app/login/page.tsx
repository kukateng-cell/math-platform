import Link from 'next/link'
import LoginForm from '@/components/login-form'

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">歡迎回來</h1>
          <p className="mt-1 text-sm text-neutral-600">登入繼續孩子的學習</p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-neutral-600">
          還沒有帳號？{' '}
          <Link href="/signup" className="font-medium text-blue-600 hover:underline">
            註冊
          </Link>
        </p>
      </div>
    </main>
  )
}
