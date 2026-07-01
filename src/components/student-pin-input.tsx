'use client'

import { useRef } from 'react'

export default function StudentPinInput() {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  function handleInput(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    e.target.value = e.target.value.replace(/\D/g, '')
    if (e.target.value && i < 3) refs.current[i + 1]?.focus()
  }

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    const input = e.currentTarget
    if (e.key === 'Backspace' && !input.value && i > 0) {
      refs.current[i - 1]?.focus()
    }
  }

  return (
    <div className="flex justify-center gap-3">
      {[0, 1, 2, 3].map((i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          name={`d${i}`}
          type="text" inputMode="numeric" autoComplete="off" maxLength={1}
          onChange={(e) => handleInput(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          autoFocus={i === 0}
          className="h-12 w-10 rounded-xl border-2 border-neutral-300 text-center text-xl font-bold
            outline-none transition focus:border-blue-500 [&:not(:placeholder-shown)]:border-blue-500"
        />
      ))}
    </div>
  )
}
