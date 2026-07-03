import Link from 'next/link'
import { createCaptcha } from '@/lib/captcha'
import StudentSignupForm from '@/components/student-signup-form'

export default async function StudentSignupPage() {
  // 在服務端生成 CAPTCHA，與家長端一致：第一次載入表單下方就直接顯示驗證問題
  const captcha = await createCaptcha()

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <div className="mb-2 text-5xl">🧑‍🎓</div>
        <h1 className="text-2xl font-bold">學生註冊</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">使用 Email + 驗證碼，自主學習</p>
      </div>

      <StudentSignupForm initialCaptcha={captcha} />

      <div className="flex gap-4 text-sm">
        <Link href="/student/login" className="text-blue-600 hover:underline dark:text-blue-400">已有帳號？登入</Link>
        <Link href="/login" className="text-neutral-400 hover:underline dark:text-gray-500">家長登入</Link>
      </div>
    </main>
  )
}
