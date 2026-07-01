'use client'

import { useActionState, useState } from 'react'
import { login, verifyLoginOtp } from '@/actions/auth'

type Props = {
  initialCaptcha: { question: string; token: string }
}

export default function LoginForm({ initialCaptcha }: Props) {
  // Step 1: 帳密 + CAPTCHA
  const [loginState, loginAction, loginPending] = useActionState(login, undefined)
  // Step 2: OTP 驗證
  const [otpState, otpAction, otpPending] = useActionState(verifyLoginOtp, undefined)

  // CAPTCHA 狀態：每次 action 回傳新的 captcha（錯誤時重新整理）
  const captcha = loginState?.captcha || initialCaptcha
  // OTP 模式
  const isOtpMode = loginState?.otpRequired
  const tempToken = loginState?.tempToken || ''

  // Step 1: 帳密登入表單
  if (!isOtpMode) {
    return (
      <form action={loginAction} className="flex w-full max-w-sm flex-col gap-4">
        {/* Email */}
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input
            id="email" name="email" type="email"
            placeholder="parent@example.com"
            className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            required
          />
          {loginState?.errors?.email && (
            <p className="text-sm text-red-500">{loginState.errors.email[0]}</p>
          )}
        </div>

        {/* 密碼 */}
        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium">密碼</label>
          <input
            id="password" name="password" type="password"
            className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            required
          />
          {loginState?.errors?.password && (
            <p className="text-sm text-red-500">{loginState.errors.password[0]}</p>
          )}
        </div>

        {/* CAPTCHA */}
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <input type="hidden" name="captchaToken" value={captcha.token} />
          <label className="mb-1 block text-sm font-medium text-neutral-600">
            🤖 請回答驗證問題
          </label>
          <p className="mb-2 text-center text-lg font-bold">{captcha.question}</p>
          <input
            name="captchaAnswer" type="number"
            placeholder="輸入答案"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-center text-lg outline-none focus:border-blue-500"
            required
          />
        </div>

        {/* 錯誤訊息 */}
        {loginState?.message && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {loginState.message}
          </p>
        )}

        <button
          type="submit" disabled={loginPending}
          className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {loginPending ? '驗證中…' : '登入'}
        </button>
      </form>
    )
  }

  // Step 2: OTP 驗證
  return (
    <form action={otpAction} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="tempToken" value={tempToken} />

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
        <div className="mb-2 text-3xl">📧</div>
        <p className="text-sm text-blue-800">{loginState?.message}</p>
        <p className="mt-1 text-xs text-blue-600">請查看信箱（開發期間請看終端機輸出）</p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="otpCode" className="text-sm font-medium text-center">
          輸入 6 位數驗證碼
        </label>
        <input
          id="otpCode" name="otpCode" type="text"
          inputMode="numeric" autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          className="rounded-lg border border-neutral-300 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          required
        />
      </div>

      {otpState?.message && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {otpState.message}
        </p>
      )}

      <button
        type="submit" disabled={otpPending}
        className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {otpPending ? '驗證中…' : '驗證登入'}
      </button>
    </form>
  )
}
