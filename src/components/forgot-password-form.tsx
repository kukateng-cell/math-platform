'use client'

import { useActionState, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  requestPasswordReset,
  verifyResetOtp,
  resetPassword,
} from '@/actions/auth'
import CaptchaChallenge from './captcha-challenge'

type Props = {
  initialCaptcha: { question: string; token: string }
}

export default function ForgotPasswordForm({ initialCaptcha }: Props) {
  const [resetState, resetAction, resetPending] = useActionState(
    requestPasswordReset,
    undefined
  )
  const [otpState, otpAction, otpPending] = useActionState(
    verifyResetOtp,
    undefined
  )
  const [pwdState, pwdAction, pwdPending] = useActionState(
    resetPassword,
    undefined
  )

  // 倒數計時（OTP 階段）
  const [countdown, setCountdown] = useState(60)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const captcha = resetState?.captcha || initialCaptcha
  // Step 判斷：
  //  step1 = 輸入 Email
  //  step2 = OTP 驗證（resetState.otpRequired 且尚未通過）
  //  step3 = 設定新密碼（otpState.ok = true）
  const requestToken = resetState?.tempToken || ''
  // OTP 驗證通過後會拿到一個新的「可重設密碼」token
  const resetToken = otpState?.tempToken || requestToken
  const devOtp = resetState?.devOtp
  const isOtpMode = !!resetState?.otpRequired && !otpState?.ok
  const isPwdMode = !!otpState?.ok
  const isDone = !!pwdState?.ok

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

  // ════════ 完成（成功頁）════════
  if (isDone) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center dark:border-green-800 dark:bg-green-950">
          <div className="mb-2 text-4xl">✅</div>
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            {pwdState?.message}
          </p>
        </div>
        <Link
          href="/login"
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-center font-medium text-white transition hover:bg-blue-700"
        >
          前往登入
        </Link>
      </div>
    )
  }

  // ════════ Step 3：設定新密碼 ════════
  if (isPwdMode) {
    return (
      <form action={pwdAction} className="flex w-full max-w-sm flex-col gap-4">
        <input type="hidden" name="tempToken" value={resetToken} />

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
          🔒 請設定您的新密碼
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium">
            新密碼
          </label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="至少 8 碼，含字母與數字"
            className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            required
          />
          {pwdState?.errors?.password && (
            <div className="text-sm text-red-500">
              {pwdState.errors.password.map((e) => (
                <p key={e}>• {e}</p>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            確認新密碼
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="再次輸入新密碼"
            className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            required
          />
        </div>

        {pwdState?.message && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">
            {pwdState.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pwdPending}
          className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {pwdPending ? '更新中…' : '重設密碼'}
        </button>
      </form>
    )
  }

  // ════════ Step 2：OTP 驗證 ════════
  if (isOtpMode) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <form action={otpAction} className="flex flex-col gap-4">
          <input type="hidden" name="tempToken" value={requestToken} />

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center dark:border-blue-800 dark:bg-blue-950">
            <div className="mb-2 text-3xl">📧</div>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {resetState?.message}
            </p>

            {/* 開發模式：直接顯示驗證碼 */}
            {devOtp && (
              <div className="mt-3 rounded-xl bg-white/80 px-4 py-3 dark:bg-gray-900/60">
                <p className="mb-1 text-xs text-blue-500">🔧 開發模式 — 驗證碼</p>
                <p className="mb-2 select-all text-3xl font-bold tracking-[0.3em] text-blue-900 dark:text-blue-100">
                  {devOtp}
                </p>
              </div>
            )}

            {!devOtp && (
              <p className="mt-1 text-xs text-blue-600">請查看您信箱中的驗證碼</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="otpCode" className="text-center text-sm font-medium">
              輸入 6 位數驗證碼
            </label>
            <input
              id="otpCode"
              name="otpCode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              className="rounded-lg border border-neutral-300 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              required
            />
          </div>

          {otpState?.message && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">
              {otpState.message}
            </p>
          )}

          <button
            type="submit"
            disabled={otpPending}
            className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {otpPending ? '驗證中…' : '驗證'}
          </button>
        </form>

        <div className="text-center">
          {countdown > 0 ? (
            <p className="text-xs text-neutral-400 dark:text-gray-500">
              未收到驗證碼？{countdown} 秒後可重新申請
            </p>
          ) : (
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-blue-600 transition hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              重新申請驗證碼
            </Link>
          )}
        </div>
      </div>
    )
  }

  // ════════ Step 1：輸入 Email + CAPTCHA ════════
  return (
    <form action={resetAction} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          註冊時的 Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="parent@example.com"
          className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          required
        />
        {resetState?.errors?.email && (
          <p className="text-sm text-red-500">{resetState.errors.email[0]}</p>
        )}
      </div>

      {/* CAPTCHA */}
      <CaptchaChallenge serverCaptcha={captcha} />

      {resetState?.message && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">
          {resetState.message}
        </p>
      )}

      <button
        type="submit"
        disabled={resetPending}
        className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {resetPending ? '處理中…' : '寄送驗證碼'}
      </button>
    </form>
  )
}
