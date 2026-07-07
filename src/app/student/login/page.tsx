import Link from 'next/link'
import { createCaptcha } from '@/lib/captcha'
import StudentLoginForm from '@/components/student-login-form'
import AnimatedBackground from '@/components/animated-background'
import { Icon } from '@/components/icon'

export default async function StudentLoginPage() {
  // 在服務端生成 CAPTCHA，與家長端一致：第一次載入 Email 下方就直接顯示驗證問題
  const captcha = await createCaptcha()

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
      <AnimatedBackground
        gradient="from-green-500 via-emerald-600 to-cyan-700"
        blobColors={['bg-emerald-400/30', 'bg-cyan-400/30', 'bg-green-400/30']}
      />
      <div className="relative w-full max-w-sm rounded-3xl bg-white/95 p-8 shadow-2xl ring-1 ring-black/5 backdrop-blur-sm dark:bg-gray-900/95 sm:p-10">
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center text-emerald-600 dark:text-emerald-400"><Icon name="student" className="h-12 w-12" /></div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">學生登入</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">輸入 Email，以驗證碼登入</p>
        </div>

        <StudentLoginForm initialCaptcha={captcha} />

      <div className="flex gap-4 text-sm">
        <Link href="/student/signup" className="text-blue-600 hover:underline dark:text-blue-400">註冊新帳號</Link>
        <Link href="/login" className="text-neutral-400 hover:underline dark:text-gray-500">家長登入</Link>
      </div>
      </div>
    </main>
  )
}
