'use client'

import { useActionState } from 'react'
import { selfStudySignup, selfStudyVerifyOtp, selfStudyResendOtp } from '@/actions/student-auth'
import CaptchaChallenge from './captcha-challenge'
import OtpResendButton from './otp-resend-button'
import { Icon } from './icon'

// OTP 重發的初始 state
const initResend = undefined as { message?: string; otpRequired?: boolean; error?: string; tempToken?: string; devOtp?: string } | undefined

type Props = {
  initialCaptcha: { question: string; token: string }
}

export default function StudentSignupForm({ initialCaptcha }: Props) {
  const [signupState, signupAction, signupPending] = useActionState(selfStudySignup, undefined)
  const [otpState, otpAction, otpPending] = useActionState(selfStudyVerifyOtp, undefined)
  const [resendState, resendAction, resendPending] = useActionState(selfStudyResendOtp, initResend)

  const captcha = signupState?.captcha || initialCaptcha
  const isOtpMode = signupState?.otpRequired
  const tempToken = signupState?.tempToken || ''
  const devOtp = signupState?.devOtp || resendState?.devOtp

  if (!isOtpMode) {
    return (
      <form action={signupAction} className="flex w-full flex-col gap-4">
        <p className="flex items-center gap-1 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-950 dark:text-green-300">
          <Icon name="sprout" className="h-4 w-4 shrink-0" />使用 Email + 驗證碼登入，完全自主學習
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
            <option value="G3">三年級 (G3)</option>
            <option value="G4">四年級 (G4)</option>
            <option value="G5">五年級 (G5)</option>
            <option value="G6">六年級 (G6)</option>
          </select>
        </div>
        {/* CAPTCHA */}
        <CaptchaChallenge serverCaptcha={captcha} />
        {signupState?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{signupState.error}</p>}
        <button type="submit" disabled={signupPending}
          className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60">
          {signupPending ? '驗證中…' : '註冊 →'}
        </button>
      </form>
    )
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <form action={otpAction} className="flex w-full flex-col gap-4">
        <input type="hidden" name="tempToken" value={tempToken} />
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center dark:border-blue-800 dark:bg-blue-950">
          <div className="mb-2 flex justify-center text-blue-500 dark:text-blue-400"><Icon name="mail" className="h-8 w-8" /></div>
          <p className="text-sm text-blue-800 dark:text-blue-200">{signupState?.message || resendState?.message}</p>

          {/* ═══ 開發模式：直接顯示驗證碼 ═══ */}
          {devOtp && (
            <div className="mt-3 rounded-xl bg-white/80 px-4 py-3">
              <p className="mb-1 flex items-center gap-1 text-xs text-blue-500"><Icon name="wrench" className="h-3.5 w-3.5" /> 開發模式 — 驗證碼</p>
              <p className="mb-2 select-all text-3xl font-bold tracking-[0.3em] text-blue-900 dark:text-blue-100">
                {devOtp}
              </p>
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById('otpCode') as HTMLInputElement
                  if (input) {
                    input.value = devOtp
                    input.dispatchEvent(new Event('input', { bubbles: true }))
                  }
                }}
                className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
              >
                一鍵填入
              </button>
            </div>
          )}

          {!devOtp && (
            <p className="mt-1 text-xs text-blue-600">請查看您信箱中的驗證碼</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-center">輸入 6 位數驗證碼</label>
          <input id="otpCode" name="otpCode" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000"
            className="rounded-lg border border-neutral-300 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white" required />
        </div>
        {otpState?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{otpState.error}</p>}
        <button type="submit" disabled={otpPending}
          className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60">
          {otpPending ? '驗證中…' : '驗證並開始學習 →'}
        </button>
      </form>

      {/* 換一組驗證碼（含倒數） */}
      <OtpResendButton tempToken={tempToken} resendState={resendState} resendAction={resendAction} resendPending={resendPending} />
    </div>
  )
}
