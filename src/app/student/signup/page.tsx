'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { studentSignup, selfStudySignup, selfStudyVerifyOtp } from '@/actions/student-auth'
import StudentPinInput from '@/components/student-pin-input'

export default function StudentSignupPage() {
  const [mode, setMode] = useState<'standard' | 'selfstudy'>('standard')

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <div className="mb-2 text-5xl">🧑‍🎓</div>
        <h1 className="text-2xl font-bold">學生註冊</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">選擇適合的學習模式</p>
      </div>

      {/* 模式切換 */}
      <div className="flex w-full rounded-xl border border-neutral-200 bg-neutral-50 p-1 dark:border-gray-600 dark:bg-gray-800">
        <button
          onClick={() => setMode('standard')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            mode === 'standard' ? 'bg-white text-neutral-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-neutral-500 hover:text-neutral-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          🔐 標準模式
        </button>
        <button
          onClick={() => setMode('selfstudy')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            mode === 'selfstudy' ? 'bg-white text-neutral-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-neutral-500 hover:text-neutral-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          🌱 自主學習
        </button>
      </div>

      {mode === 'standard' ? <StandardSignupForm /> : <SelfStudySignupForm />}

      <div className="flex gap-4 text-sm">
        <Link href="/student/login" className="text-blue-600 hover:underline dark:text-blue-400">已有帳號？登入</Link>
        <Link href="/login" className="text-neutral-400 hover:underline dark:text-gray-500">家長登入</Link>
      </div>
    </main>
  )
}

// ============ 標準模式（帳密 + PIN）============
function StandardSignupForm() {
  const [state, action, pending] = useActionState(studentSignup, undefined)

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">
        🔐 使用 PIN 碼快速登入，可綁定家長帳號
      </p>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">暱稱</label>
        <input name="nickname" required maxLength={20} placeholder="小華"
          className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Email</label>
        <input name="email" type="email" required placeholder="student@example.com"
          className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">密碼</label>
        <input name="password" type="password" required placeholder="至少 4 碼"
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
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-center">設定 4 位數 PIN 碼</label>
        <StudentPinInput />
      </div>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending}
        className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60">
        {pending ? '建立中…' : '註冊並開始練習 →'}
      </button>
    </form>
  )
}

// ============ 自主學習模式（CAPTCHA + OTP）============
function SelfStudySignupForm() {
  const [signupState, signupAction, signupPending] = useActionState(selfStudySignup, undefined)
  const [otpState, otpAction, otpPending] = useActionState(selfStudyVerifyOtp, undefined)

  const captcha = signupState?.captcha
  const isOtpMode = signupState?.otpRequired
  const tempToken = signupState?.tempToken || ''
  const devOtp = signupState?.devOtp

  if (!isOtpMode) {
    return (
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
          <label className="text-sm font-medium">密碼</label>
          <input name="password" type="password" required placeholder="至少 4 碼"
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
    )
  }

  // Step 2: OTP
  return (
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
  )
}
