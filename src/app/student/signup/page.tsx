'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { selfStudySignup, selfStudyVerifyOtp } from '@/actions/student-auth'

export default function StudentSignupPage() {
  const [signupState, signupAction, signupPending] = useActionState(selfStudySignup, undefined)
  const [otpState, otpAction, otpPending] = useActionState(selfStudyVerifyOtp, undefined)

  const captcha = signupState?.captcha
  const isOtpMode = signupState?.otpRequired
  const tempToken = signupState?.tempToken || ''
  const devOtp = signupState?.devOtp

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <div className="mb-2 text-5xl">🧑‍🎓</div>
        <h1 className="text-2xl font-bold">學生註冊</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">使用 Email + 驗證碼，自主學習</p>
      </div>

      {!isOtpMode ? (
        <form action={signupAction} className="flex w-full flex-col gap-4">
          <p className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-950 dark:text-green-300">
            🌱 使用 Email + 驗證碼登入，完全自主學習
          </p>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">暱稱</label>
            <input name="nickname" required maxLength={20} placeholder="小華"
              className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Email</label>
            <input name="email" type="email" required placeholder="self@example.com"
              className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">年級</label>
            <select name="gradeLevel" defaultValue="G1"
              className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white">
              <option value="K">幼兒園 (K)</option>
              <option value="G1">一年級 (G1)</option>
              <option value="G2">二年級 (G2)</option>
            </select>
          </div>
          {captcha && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-gray-600 dark:bg-gray-800">
              <input type="hidden" name="captchaToken" value={captcha.token} />
              <label className="mb-1 block text-sm font-medium text-neutral-600 dark:text-gray-300">🤖 請回答驗證問題</label>
              <p className="mb-2 text-center text-lg font-bold dark:text-white">{captcha.question}</p>
              <input name="captchaAnswer" type="number" placeholder="輸入答案"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-center text-lg outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white" required />
            </div>
          )}
          {signupState?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{signupState.error}</p>}
          <button type="submit" disabled={signupPending}
            className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60">
            {signupPending ? '驗證中…' : '註冊 →'}
          </button>
        </form>
      ) : (
        <form action={otpAction} className="flex w-full flex-col gap-4">
          <input type="hidden" name="tempToken" value={tempToken} />
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center dark:border-blue-800 dark:bg-blue-950">
            <div className="mb-2 text-3xl">📧</div>
            <p className="text-sm text-blue-800 dark:text-blue-200">{signupState?.message}</p>
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
            {otpPending ? '驗證中…' : '驗證並開始學習 →'}
          </button>
        </form>
      )}

      <div className="flex gap-4 text-sm">
        <Link href="/student/login" className="text-blue-600 hover:underline dark:text-blue-400">已有帳號？登入</Link>
        <Link href="/login" className="text-neutral-400 hover:underline dark:text-gray-500">家長登入</Link>
      </div>
    </main>
  )
}
