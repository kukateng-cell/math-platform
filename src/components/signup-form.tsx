'use client'

import { useActionState, useState, useEffect, useRef } from 'react'
import { signup, verifySignupOtp, resendSignupOtp } from '@/actions/auth'
import CaptchaChallenge from './captcha-challenge'

type Props = {
  initialCaptcha: { question: string; token: string }
}

export default function SignupForm({ initialCaptcha }: Props) {
  const [signupState, signupAction, signupPending] = useActionState(signup, undefined)
  const [otpState, otpAction, otpPending] = useActionState(verifySignupOtp, undefined)
  const [resendState, resendAction, resendPending] = useActionState(resendSignupOtp, undefined)

  const [countdown, setCountdown] = useState(60)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const captcha = signupState?.captcha || initialCaptcha
  const isOtpMode = signupState?.otpRequired
  const tempToken = signupState?.tempToken || ''
  const devOtp = signupState?.devOtp || resendState?.devOtp

  useEffect(() => {
    if (isOtpMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCountdown(60)
      timerRef.current = setInterval(() => {
        setCountdown((prev) => { if (prev <= 1) { clearInterval(timerRef.current!); return 0 }; return prev - 1 })
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isOtpMode])

  useEffect(() => {
    if (resendState?.otpRequired) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCountdown(60)
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setCountdown((prev) => { if (prev <= 1) { clearInterval(timerRef.current!); return 0 }; return prev - 1 })
      }, 1000)
    }
  }, [resendState])

  if (!isOtpMode) {
    return (
      <form action={signupAction} className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium">稱呼</label>
          <input id="name" name="name" type="text" placeholder="王小明" required
            className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
          {signupState?.errors?.name && <p className="text-sm text-red-500">{signupState.errors.name[0]}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" placeholder="parent@example.com" required
            className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
          {signupState?.errors?.email && <p className="text-sm text-red-500">{signupState.errors.email[0]}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium">密碼</label>
          <input id="password" name="password" type="password" placeholder="至少 8 碼，含字母與數字" required
            className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
          {signupState?.errors?.password && <div className="text-sm text-red-500">{signupState.errors.password.map((e) => <p key={e}>• {e}</p>)}</div>}
        </div>
        <CaptchaChallenge serverCaptcha={captcha} />
        {signupState?.message && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{signupState.message}</p>}
        <button type="submit" disabled={signupPending}
          className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60">
          {signupPending ? '驗證中…' : '註冊'}
        </button>
      </form>
    )
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <form action={otpAction} className="flex flex-col gap-4">
        <input type="hidden" name="tempToken" value={tempToken} />
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center dark:border-blue-800 dark:bg-blue-950">
          <div className="mb-2 text-3xl">📧</div>
          <p className="text-sm text-blue-800 dark:text-blue-200">{signupState?.message || resendState?.message}</p>
          {devOtp && (
            <div className="mt-3 rounded-xl bg-white/80 px-4 py-3 dark:bg-gray-800/80">
              <p className="mb-1 text-xs text-blue-500">🔧 開發模式 — 驗證碼</p>
              <p className="mb-2 select-all text-3xl font-bold tracking-[0.3em] text-blue-900 dark:text-blue-100">{devOtp}</p>
              <button type="button" onClick={() => { const i = document.getElementById('otpCode') as HTMLInputElement; if (i) { i.value = devOtp; i.dispatchEvent(new Event('input', { bubbles: true })) } }}
                className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700">一鍵填入</button>
            </div>
          )}
          {!devOtp && <p className="mt-1 text-xs text-blue-600">請查看您信箱中的驗證碼</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="otpCode" className="text-sm font-medium text-center">輸入 6 位數驗證碼</label>
          <input id="otpCode" name="otpCode" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" required
            className="rounded-lg border border-neutral-300 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
        </div>
        {otpState?.message && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{otpState.message}</p>}
        <button type="submit" disabled={otpPending}
          className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60">
          {otpPending ? '驗證中…' : '驗證並完成註冊'}
        </button>
      </form>
      <form action={resendAction} className="text-center">
        <input type="hidden" name="tempToken" value={tempToken} />
        {countdown > 0 ? (
          <p className="text-xs text-neutral-400 dark:text-gray-500">未收到驗證碼？{countdown} 秒後可重新發送</p>
        ) : (
          <button type="submit" disabled={resendPending}
            className="text-sm font-medium text-blue-600 transition hover:text-blue-800 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300">
            {resendPending ? '發送中…' : '重新發送驗證碼'}
          </button>
        )}
      </form>
    </div>
  )
}
