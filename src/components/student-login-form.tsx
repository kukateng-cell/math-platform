'use client'

import { useActionState } from 'react'
import { selfStudyLogin, selfStudyVerifyOtp, selfStudyResendOtp } from '@/actions/student-auth'
import CaptchaChallenge from './captcha-challenge'
import OtpResendButton from './otp-resend-button'
import { Icon } from './icon'

// OTP 重發的初始 state
const initResend = undefined as { message?: string; otpRequired?: boolean; error?: string; tempToken?: string } | undefined

type Props = {
  initialCaptcha: { question: string; token: string }
}

export default function StudentLoginForm({ initialCaptcha }: Props) {
  const [loginState, loginAction, loginPending] = useActionState(selfStudyLogin, undefined)
  const [otpState, otpAction, otpPending] = useActionState(selfStudyVerifyOtp, undefined)
  const [resendState, resendAction, resendPending] = useActionState(selfStudyResendOtp, initResend)

  const captcha = loginState?.captcha || initialCaptcha
  const isOtpMode = loginState?.otpRequired
  const tempToken = loginState?.tempToken || ''

  if (!isOtpMode) {
    return (
      <form action={loginAction} className="flex w-full flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Email</label>
          <input name="email" type="email" required placeholder="student@example.com"
            className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
        </div>
        {/* CAPTCHA */}
        <CaptchaChallenge serverCaptcha={captcha} />
        {loginState?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{loginState.error}</p>}
        <button type="submit" disabled={loginPending}
          className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60">
          {loginPending ? '驗證中…' : '下一步 →'}
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
          <p className="text-sm text-blue-800 dark:text-blue-200">{loginState?.message}</p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-center">輸入 6 位數驗證碼</label>
          <input id="otpCode" name="otpCode" type="text" inputMode="numeric" maxLength={6} placeholder="000000"
            className="rounded-lg border border-neutral-300 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white" required />
        </div>
        {otpState?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{otpState.error}</p>}
        <button type="submit" disabled={otpPending}
          className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60">
          {otpPending ? '驗證中…' : '登入學習 →'}
        </button>
      </form>

      {/* 換一組驗證碼（含倒數） */}
      <OtpResendButton tempToken={tempToken} resendState={resendState} resendAction={resendAction} resendPending={resendPending} />
    </div>
  )
}
