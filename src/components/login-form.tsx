'use client'

import { useActionState, useState, useEffect, useRef } from 'react'
import { login, verifyLoginOtp, resendOtp } from '@/actions/auth'

type Props = {
  initialCaptcha: { question: string; token: string }
}

export default function LoginForm({ initialCaptcha }: Props) {
  const [loginState, loginAction, loginPending] = useActionState(login, undefined)
  const [otpState, otpAction, otpPending] = useActionState(verifyLoginOtp, undefined)
  const [resendState, resendAction, resendPending] = useActionState(resendOtp, undefined)

  // 倒數計時
  const [countdown, setCountdown] = useState(60)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const captcha = loginState?.captcha || initialCaptcha
  const isOtpMode = loginState?.otpRequired
  const tempToken = loginState?.tempToken || ''
  // 開發模式 OTP：從 login 或 resend 回傳中取得
  const devOtp = loginState?.devOtp || resendState?.devOtp

  // OTP 模式啟動時開始倒數
  useEffect(() => {
    if (isOtpMode) {
      setCountdown(60)
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isOtpMode])

  // 重新發送後重設計時器
  useEffect(() => {
    if (resendState?.otpRequired) {
      setCountdown(60)
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
  }, [resendState])

  // Step 1: 帳密 + CAPTCHA
  if (!isOtpMode) {
    return (
      <form action={loginAction} className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" placeholder="parent@example.com"
            className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" required />
          {loginState?.errors?.email && <p className="text-sm text-red-500">{loginState.errors.email[0]}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium">密碼</label>
          <input id="password" name="password" type="password"
            className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" required />
          {loginState?.errors?.password && <p className="text-sm text-red-500">{loginState.errors.password[0]}</p>}
        </div>

        {/* CAPTCHA */}
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <input type="hidden" name="captchaToken" value={captcha.token} />
          <label className="mb-1 block text-sm font-medium text-neutral-600">🤖 請回答驗證問題</label>
          <p className="mb-2 text-center text-lg font-bold">{captcha.question}</p>
          <input name="captchaAnswer" type="number" placeholder="輸入答案"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-center text-lg outline-none focus:border-blue-500" required />
        </div>

        {loginState?.message && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{loginState.message}</p>
        )}

        <button type="submit" disabled={loginPending}
          className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60">
          {loginPending ? '驗證中…' : '登入'}
        </button>
      </form>
    )
  }

  // Step 2: OTP 驗證
  const displayOtp = devOtp // 直接顯示在開發模式

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <form action={otpAction} className="flex flex-col gap-4">
        <input type="hidden" name="tempToken" value={tempToken} />

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
          <div className="mb-2 text-3xl">📧</div>
          <p className="text-sm text-blue-800">{loginState?.message || resendState?.message}</p>

          {/* ═══ 開發模式：直接顯示驗證碼 ═══ */}
          {displayOtp && (
            <div className="mt-3 rounded-xl bg-white/80 px-4 py-3">
              <p className="mb-1 text-xs text-blue-500">🔧 開發模式 — 驗證碼</p>
              <p className="mb-2 select-all text-3xl font-bold tracking-[0.3em] text-blue-900">
                {displayOtp}
              </p>
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById('otpCode') as HTMLInputElement
                  if (input) {
                    input.value = displayOtp
                    input.dispatchEvent(new Event('input', { bubbles: true }))
                  }
                }}
                className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
              >
                一鍵填入
              </button>
            </div>
          )}

          {!displayOtp && (
            <p className="mt-1 text-xs text-blue-600">請查看您信箱中的驗證碼</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="otpCode" className="text-sm font-medium text-center">輸入 6 位數驗證碼</label>
          <input id="otpCode" name="otpCode" type="text" inputMode="numeric"
            autoComplete="one-time-code" maxLength={6} placeholder="000000"
            className="rounded-lg border border-neutral-300 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" required />
        </div>

        {otpState?.message && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{otpState.message}</p>
        )}

        <button type="submit" disabled={otpPending}
          className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60">
          {otpPending ? '驗證中…' : '驗證登入'}
        </button>
      </form>

      {/* ═══ 重新發送（有倒數計時）═══ */}
      <form action={resendAction} className="text-center">
        <input type="hidden" name="tempToken" value={tempToken} />
        {countdown > 0 ? (
          <p className="text-xs text-neutral-400">
            未收到驗證碼？{countdown} 秒後可重新發送
          </p>
        ) : (
          <button type="submit" disabled={resendPending}
            className="text-sm font-medium text-blue-600 transition hover:text-blue-800 disabled:opacity-50">
            {resendPending ? '發送中…' : '重新發送驗證碼'}
          </button>
        )}
      </form>
    </div>
  )
}
