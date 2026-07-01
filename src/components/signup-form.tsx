'use client'

import { useActionState } from 'react'
import { signup } from '@/actions/auth'

export default function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined)

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          稱呼
        </label>
        <input
          id="name"
          name="name"
          type="text"
          placeholder="王小明"
          className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          required
        />
        {state?.errors?.name && (
          <p className="text-sm text-red-500">{state.errors.name[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="parent@example.com"
          className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          required
        />
        {state?.errors?.email && (
          <p className="text-sm text-red-500">{state.errors.email[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          密碼
        </label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="至少 8 碼，含字母與數字"
          className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          required
        />
        {state?.errors?.password && (
          <div className="text-sm text-red-500">
            {state.errors.password.map((e) => (
              <p key={e}>• {e}</p>
            ))}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? '建立中…' : '註冊'}
      </button>
    </form>
  )
}
