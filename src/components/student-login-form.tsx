'use client'

import { useActionState } from 'react'
import { selfStudyLogin, selfStudyVerifyOtp } from '@/actions/student-auth'

type Props = {
  initialCaptcha: { question: string; token: string }
}

export default function StudentLoginForm({ initialCaptcha }: Props) {
  const [loginState, loginAction, loginPending] = useActionState(selfStudyLogin, undefined)
  const [otpState, otpAction, otpPending] = useActionState(selfStudyVerifyOtp, undefined)

  const captcha = loginState?.captcha || initialCaptcha
  const isOtpMode = loginState?.otpRequired
  const tempToken = loginState?.tempToken || ''
  const devOtp = loginState?.devOtp

  if (!isOtpMode) {
    return (
      <form action={loginAction} className="flex w-full flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Email</label>
          <input name="email" type="email" required placeholder="student@example.com"
            className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
        </div>
        {/* CAPTCHA — 與家長端一致，Email 下方直接顯示驗證問題 */}
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-gray-600 dark:bg-gray-800">
          <input type="hidden" name="captchaToken" value={captcha.token} />
          <label className="mb-1 block text-sm font-medium text-neutral-600 dark:text-gray-300">🤖 請回答驗證問題</label>
          <p className="mb-2 text-center text-lg font-bold dark:text-white">{captcha.question}</p>
          <input name="captchaAnswer" type="number" placeholder="輸入答案"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-center text-lg outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white" required />
        </div>
        {loginState?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{loginState.error}</p>}
        <button type="submit" disabled={loginPending}
          className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60">
          {loginPending ? '驗證中…' : '下一步 →'}
        </button>
      </form>
    )
  }

  return (
    <form action={otpAction} className="flex w-full flex-col gap-4">
      <input type="hidden" name="tempToken" value={tempToken} />
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center dark:border-blue-800 dark:bg-blue-950">
        <div className="mb-2 text-3xl">📧</div>
        <p className="text-sm text-blue-800 dark:text-blue-200">{loginState?.message}</p>
        {devOtp && (
          <div className="mt-2">
            <p className="text-xs text-blue-500 dark:text-blue-400">🔧 驗證碼</p>
            <p className="select-all text-2xl font-bold tracking-wider text-blue-900 dark:text-blue-100">{devOtp}</p>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-center">輸入 6 位數驗證碼</label>
        <input name="otpCode" type="text" inputMode="numeric" maxLength={6} placeholder="000000"
          className="rounded-lg border border-neutral-300 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white" required />
      </div>
      {otpState?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{otpState.error}</p>}
      <button type="submit" disabled={otpPending}
        className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60">
        {otpPending ? '驗證中…' : '登入學習 →'}
      </button>
    </form>
  )
}
