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

        <p className="mt-6 text-center text-sm text-neutral-600 dark:text-gray-300">
          還沒有帳號？{' '}
          <Link href="/student/signup" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
            學生註冊
          </Link>
        </p>

        {/* 其他登入方式 */}
        <div className="mt-4 space-y-2 border-t border-neutral-200 pt-4 text-center text-sm dark:border-gray-700">
          <p className="text-neutral-500 dark:text-gray-400">其他登入方式：</p>
          <Link href="/login" className="flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
            <Icon name="calculator" className="h-4 w-4" />家長登入（Email + 密碼）
          </Link>
        </div>
      </div>
    </main>
  )
}
