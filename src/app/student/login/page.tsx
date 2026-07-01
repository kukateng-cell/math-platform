'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { studentLogin } from '@/actions/student-auth'
import StudentPinInput from '@/components/student-pin-input'

export default function StudentLoginPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <div className="mb-2 text-5xl">🧑‍🎓</div>
        <h1 className="text-2xl font-bold">學生登入</h1>
        <p className="mt-1 text-sm text-neutral-500">使用帳號密碼 + PIN 碼登入</p>
      </div>
      <StudentLoginForm />
      <div className="flex gap-4 text-sm">
        <Link href="/student/signup" className="text-blue-600 hover:underline">註冊新帳號</Link>
        <Link href="/login" className="text-neutral-400 hover:underline">家長登入</Link>
      </div>
    </main>
  )
}

function StudentLoginForm() {
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
        <label className="text-sm font-medium text-center">PIN 碼（4 位數）</label>
        <StudentPinInput />
      </div>
      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
      <button type="submit" disabled={pending}
        className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60">
        {pending ? '登入中…' : '登入練習 →'}
      </button>
    </form>
  )
}
