'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { studentLogin, selfStudyLogin, selfStudyVerifyOtp } from '@/actions/student-auth'
import StudentPinInput from '@/components/student-pin-input'

export default function StudentLoginPage() {
  const [mode, setMode] = useState<'standard' | 'selfstudy'>('standard')

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <div className="mb-2 text-5xl">🧑‍🎓</div>
        <h1 className="text-2xl font-bold">學生登入</h1>
        <p className="mt-1 text-sm text-neutral-500">選擇登入方式</p>
      </div>

      {/* 模式切換 */}
      <div className="flex w-full rounded-xl border border-neutral-200 bg-neutral-50 p-1">
        <button
          onClick={() => setMode('standard')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            mode === 'standard' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          🔐 PIN 登入
        </button>
        <button
          onClick={() => setMode('selfstudy')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            mode === 'selfstudy' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          🌱 驗證碼登入
        </button>
      </div>

      {mode === 'standard' ? <StandardLoginForm /> : <SelfStudyLoginForm />}

      <div className="flex gap-4 text-sm">
        <Link href="/student/signup" className="text-blue-600 hover:underline">註冊新帳號</Link>
        <Link href="/login" className="text-neutral-400 hover:underline">家長登入</Link>
      </div>
    </main>
  )
}

// ============ PIN 登入 ============
function StandardLoginForm() {
  const [state, action, pending] = useActionState(studentLogin, undefined)

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Email</label>
        <input name="email" type="email" required
          className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">密碼</label>
        <input name="password" type="password" required
          className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-center">PIN 碼</label>
        <StudentPinInput />
      </div>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending}
        className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60">
        {pending ? '登入中…' : '登入練習 →'}
      </button>
    </form>
  )
}

// ============ 驗證碼登入 ============
function SelfStudyLoginForm() {
  const [loginState, loginAction, loginPending] = useActionState(selfStudyLogin, undefined)
  const [otpState, otpAction, otpPending] = useActionState(selfStudyVerifyOtp, undefined)

  const captcha = loginState?.captcha
  const isOtpMode = loginState?.otpRequired
  const tempToken = loginState?.tempToken || ''
  const devOtp = loginState?.devOtp

  if (!isOtpMode) {
    return (
      <form action={loginAction} className="flex w-full flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Email</label>
          <input name="email" type="email" required
            className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">密碼</label>
          <input name="password" type="password" required
            className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500" />
        </div>
        {captcha && (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <input type="hidden" name="captchaToken" value={captcha.token} />
            <label className="mb-1 block text-sm font-medium text-neutral-600">🤖 請回答驗證問題</label>
            <p className="mb-2 text-center text-lg font-bold">{captcha.question}</p>
            <input name="captchaAnswer" type="number" placeholder="輸入答案"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-center text-lg outline-none focus:border-blue-500" required />
          </div>
        )}
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
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
        <div className="mb-2 text-3xl">📧</div>
        <p className="text-sm text-blue-800">{loginState?.message}</p>
        {devOtp && (
          <div className="mt-2">
            <p className="text-xs text-blue-500">🔧 驗證碼</p>
            <p className="select-all text-2xl font-bold tracking-wider text-blue-900">{devOtp}</p>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-center">輸入 6 位數驗證碼</label>
        <input name="otpCode" type="text" inputMode="numeric" maxLength={6} placeholder="000000"
          className="rounded-lg border border-neutral-300 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-blue-500" required />
      </div>
      {otpState?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{otpState.error}</p>}
      <button type="submit" disabled={otpPending}
        className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60">
        {otpPending ? '驗證中…' : '登入學習 →'}
      </button>
    </form>
  )
}
