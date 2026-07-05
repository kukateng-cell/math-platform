import Link from 'next/link'
import { createCaptcha } from '@/lib/captcha'
import StudentSignupForm from '@/components/student-signup-form'
import AnimatedBackground from '@/components/animated-background'

export default async function StudentSignupPage() {
  // 在服務端生成 CAPTCHA，與家長端一致：第一次載入表單下方就直接顯示驗證問題
  const captcha = await createCaptcha()

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
      <AnimatedBackground
        gradient="from-teal-500 via-cyan-600 to-blue-700"
        blobColors={['bg-cyan-400/30', 'bg-teal-400/30', 'bg-blue-400/30']}
      />
      <div className="relative w-full max-w-sm rounded-3xl bg-white/95 p-8 shadow-2xl ring-1 ring-black/5 backdrop-blur-sm dark:bg-gray-900/95 sm:p-10">
        <div className="mb-6 text-center">
          <div className="mb-3 text-5xl">🧑‍🎓</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">學生註冊</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">使用 Email + 驗證碼，自主學習</p>
        </div>

        <StudentSignupForm initialCaptcha={captcha} />

      <div className="flex gap-4 text-sm">
        <Link href="/student/login" className="text-blue-600 hover:underline dark:text-blue-400">已有帳號？登入</Link>
        <Link href="/login" className="text-neutral-400 hover:underline dark:text-gray-500">家長登入</Link>
      </div>
      </div>
    </main>
  )
}
