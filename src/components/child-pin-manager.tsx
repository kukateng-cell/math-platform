'use client'

import { useState } from 'react'
import { setChildPin, removeChildPin } from '@/actions/auth'

export default function ChildPinManager({
  childId,
  currentPin,
}: {
  childId: string
  currentPin: string | null
}) {
  const [open, setOpen] = useState(false)
  const [pin, setPin] = useState(['', '', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSave() {
    const code = pin.join('')
    if (code.length !== 4) {
      setError('請輸入 4 位數字')
      return
    }
    setError(null)
    setSuccess(false)

    try {
      const formData = new FormData()
      formData.set('childId', childId)
      formData.set('pin', code)
      await setChildPin(formData)
      setSuccess(true)
      setPin(['', '', '', ''])
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '設定失敗')
    }
  }

  async function handleRemove() {
    const formData = new FormData()
    formData.set('childId', childId)
    await removeChildPin(formData)
    setOpen(false)
    setSuccess(true)
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2 text-xs">
        {currentPin ? (
          <>
            <span className="rounded bg-green-50 px-1.5 py-0.5 text-green-600 font-mono dark:bg-green-950 dark:text-green-400">
              PIN: {currentPin}
            </span>
            <button onClick={() => setOpen(true)} className="text-blue-500 hover:underline">
              更改
            </button>
            <form action={removeChildPin}>
              <input type="hidden" name="childId" value={childId} />
              <button type="submit" className="text-neutral-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400">
                移除
              </button>
            </form>
          </>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="rounded border border-dashed border-neutral-300 px-2 py-0.5 text-xs text-neutral-400 hover:border-blue-400 hover:text-blue-500 dark:border-gray-600 dark:text-gray-500 dark:hover:border-blue-400 dark:hover:text-blue-400"
          >
            + 設定 PIN
          </button>
        )}
        {success && <span className="text-green-600">✓</span>}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs dark:border-gray-600 dark:bg-gray-800">
      <p className="mb-2 text-neutral-600 dark:text-gray-300">
        {currentPin ? '更改孩子 PIN 碼' : '設定 4 位數 PIN 碼（讓孩子可以直接練習）'}
      </p>
      <div className="mb-2 flex gap-1.5">
        {pin.map((d, i) => (
          <input
            key={i}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '')
              const newPin = [...pin]
              newPin[i] = v
              setPin(newPin)
              if (v && i < 3) {
                const next = e.target.parentElement?.children[i + 1] as HTMLInputElement
                next?.focus()
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !d && i > 0) {
                const prev = e.currentTarget.parentElement?.children[i - 1] as HTMLInputElement
                prev?.focus()
              }
            }}
            className="h-9 w-8 rounded-lg border border-neutral-300 text-center text-lg font-bold outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            autoFocus={i === 0}
          />
        ))}
      </div>
      {error && <p className="mb-1 text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleSave} className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700">
          儲存
        </button>
        <button onClick={() => { setOpen(false); setError(null) }} className="rounded border border-neutral-300 px-3 py-1 hover:bg-neutral-100 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700">
          取消
        </button>
      </div>
    </div>
  )
}
