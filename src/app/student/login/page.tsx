'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { selfStudyLogin, selfStudyVerifyOtp } from '@/actions/student-auth'

export default function StudentLoginPage() {
  const [loginState, loginAction, loginPending] = useActionState(selfStudyLogin, undefined)
  const [otpState, otpAction, otpPending] = useActionState(selfStudyVerifyOtp, undefined)

  const captcha = loginState?.captcha
  const isOtpMode = loginState?.otpRequired
  const tempToken = loginState?.tempToken || ''
  const devOtp = loginState?.devOtp

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-5 px-4 sm:gap-6">
      <div className="text-center">
        <div className="mb-2 text-4xl sm:text-5xl">🧑‍🎓</div>
        <h1 className="text-xl font-bold sm:text-2xl">學生登入</h1>
        <p className="mt-1 text-xs text-neutral-500 dark:text-gray-400 sm:text-sm">輸入 Email，以驗證碼登入</p>
      </div>

      {!isOtpMode ? (
        <form action={loginAction} className="flex w-full flex-col gap-3 sm:gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Email</label>
            <input name="email" type="email" required placeholder="student@example.com"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white sm:text-base" />
          </div>
          {captcha && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-gray-600 dark:bg-gray-800">
              <input type="hidden" name="captchaToken" value={captcha.token} />
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-gray-300 sm:text-sm">🤖 請回答驗證問題</label>
              <p className="mb-2 text-center text-base font-bold dark:text-white sm:text-lg">{captcha.question}</p>
              <input name="captchaAnswer" type="number" placeholder="輸入答案"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-center text-base outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white sm:text-lg" required />
            </div>
          )}
          {loginState?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 sm:text-sm">{loginState.error}</p>}
          <button type="submit" disabled={loginPending}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 sm:text-base">
            {loginPending ? '驗證中…' : '下一步 →'}
          </button>
        </form>
      ) : (
        <form action={otpAction} className="flex w-full flex-col gap-3 sm:gap-4">
          <input type="hidden" name="tempToken" value={tempToken} />
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center dark:border-blue-800 dark:bg-blue-950 sm:p-4">
            <div className="mb-2 text-2xl sm:text-3xl">📧</div>
            <p className="text-xs text-blue-800 dark:text-blue-200 sm:text-sm">{loginState?.message}</p>
            {devOtp && (
              <div className="mt-2">
                <p className="text-[10px] text-blue-500 dark:text-blue-400 sm:text-xs">🔧 驗證碼</p>
                <p className="select-all text-xl font-bold tracking-wider text-blue-900 dark:text-blue-100 sm:text-2xl">{devOtp}</p>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-center sm:text-sm">輸入 6 位數驗證碼</label>
            <input name="otpCode" type="text" inputMode="numeric" maxLength={6} placeholder="000000"
              className="rounded-lg border border-neutral-300 px-3 py-2.5 text-center text-xl tracking-[0.5em] outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white sm:py-3 sm:text-2xl" required />
          </div>
          {otpState?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 sm:text-sm">{otpState.error}</p>}
          <button type="submit" disabled={otpPending}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 sm:text-base">
            {otpPending ? '驗證中…' : '登入學習 →'}
          </button>
        </form>
      )}

      <div className="flex gap-3 text-xs sm:gap-4 sm:text-sm">
        <Link href="/student/signup" className="text-blue-600 hover:underline dark:text-blue-400">註冊新帳號</Link>
        <Link href="/login" className="text-neutral-400 hover:underline dark:text-gray-500">家長登入</Link>
      </div>
    </main>
  )
}
