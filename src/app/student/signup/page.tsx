'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { studentSignup } from '@/actions/student-auth'
import StudentPinInput from '@/components/student-pin-input'

export default function StudentSignupPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <div className="mb-2 text-5xl">🧑‍🎓</div>
        <h1 className="text-2xl font-bold">學生註冊</h1>
        <p className="mt-1 text-sm text-neutral-500">建立自己的帳號，獨立開始學習</p>
      </div>
      <StudentSignupForm />
      <div className="flex gap-4 text-sm">
        <Link href="/student/login" className="text-blue-600 hover:underline">已有帳號？登入</Link>
        <Link href="/login" className="text-neutral-400 hover:underline">家長登入</Link>
      </div>
    </main>
  )
}

function StudentSignupForm() {
  const [state, action, pending] = useActionState(studentSignup, undefined)

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">暱稱</label>
        <input name="nickname" required maxLength={20} placeholder="小華"
          className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Email</label>
        <input name="email" type="email" required placeholder="student@example.com"
          className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">密碼</label>
        <input name="password" type="password" required placeholder="至少 4 碼"
          className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">年級</label>
        <select name="gradeLevel" defaultValue="G1"
          className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500">
          <option value="K">幼兒園 (K)</option>
          <option value="G1">一年級 (G1)</option>
          <option value="G2">二年級 (G2)</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-center">設定 4 位數 PIN 碼（登入用）</label>
        <StudentPinInput />
      </div>
      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
      <button type="submit" disabled={pending}
        className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60">
        {pending ? '建立中…' : '註冊並開始練習 →'}
      </button>
    </form>
  )
}
