'use client'

import { useActionState, useRef } from 'react'
import { childLogin } from '@/actions/child-auth'

export default function ChildPinForm() {
  const [state, action, pending] = useActionState(childLogin, undefined)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  function handleDigitInput(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, '')
    e.target.value = val
    if (val && index < 3) refs.current[index + 1]?.focus()
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    const input = e.currentTarget
    if (e.key === 'Backspace' && !input.value && index > 0) {
      refs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLFormElement>) {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    const inputs = e.currentTarget.querySelectorAll<HTMLInputElement>('input[name^="d"]')
    inputs.forEach((input, i) => {
      input.value = text[i] || ''
    })
    const nextIndex = Math.min(text.length, 3)
    refs.current[nextIndex]?.focus()
  }

  return (
    <form action={action} onPaste={handlePaste} className="flex w-full flex-col items-center gap-6">
      <div className="flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el }}
            name={`d${i}`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={1}
            defaultValue=""
            onChange={(e) => handleDigitInput(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            autoFocus={i === 0}
            className="h-14 w-12 rounded-xl border-2 text-center text-2xl font-bold outline-none transition
              border-neutral-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400
              [&:not(:placeholder-shown)]:border-blue-500 [&:not(:placeholder-shown)]:bg-blue-50 dark:[&:not(:placeholder-shown)]:bg-blue-950"
          />
        ))}
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700 disabled:opacity-40"
      >
        {pending ? '驗證中…' : '開始練習 →'}
      </button>
    </form>
  )
}
