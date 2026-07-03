'use client'

import { useEffect, useRef } from 'react'

type Mode = 'numeric' | 'text'

type Props = {
  value: string
  onChange: (val: string) => void
  onSubmit: () => void
  disabled?: boolean
  /** 輸入模式：numeric(數字+小數點鍵盤) / text(文字輸入框)，預設 numeric */
  mode?: Mode
  /** 數字模式最多輸入位數（含小數點），預設 5 */
  maxLength?: number
  /** 文字模式 placeholder */
  placeholder?: string
}

export default function NumberPad({
  value,
  onChange,
  onSubmit,
  disabled,
  mode = 'numeric',
  maxLength = 5,
  placeholder = '輸入答案',
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const keys: (number | string)[][] = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    ['.', 0, '⌫'],
  ]

  // 數字鍵盤：點擊按鍵
  function handleKey(k: number | string) {
    if (disabled) return
    if (k === '⌫') {
      onChange(value.slice(0, -1))
    } else if (typeof k === 'number') {
      if (value.length >= maxLength) return
      onChange(value + String(k))
    } else if (k === '.') {
      // 小數點：只能出現一次，且不能是第一個字元
      if (value.includes('.')) return
      if (value.length >= maxLength) return
      onChange(value === '' ? '0.' : value + '.')
    }
  }

  // 清空全部
  function handleClear() {
    if (disabled) return
    onChange('')
  }

  // 數字模式：支援實體鍵盤直接輸入（0-9、小數點、退格、Enter 送出）
  useEffect(() => {
    if (mode !== 'numeric') return
    function onKey(e: KeyboardEvent) {
      if (disabled) return
      // 避免與頁面其它快速鍵衝突：只在輸入框未聚焦時處理
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        if (value.length >= maxLength) return
        onChange(value + e.key)
      } else if (e.key === '.') {
        e.preventDefault()
        if (value.includes('.') || value.length >= maxLength) return
        onChange(value === '' ? '0.' : value + '.')
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        onChange(value.slice(0, -1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (value) onSubmit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, disabled, value, maxLength, onChange, onSubmit])

  // ============ 文字模式：直接用輸入框 ============
  if (mode === 'text') {
    return (
      <div className="mx-auto w-full max-w-xs sm:max-w-sm">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          autoFocus
          autoComplete="off"
          enterKeyHint="done"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (value.trim()) onSubmit()
            }
          }}
          className="w-full rounded-xl border-2 border-neutral-200 bg-white px-4 py-4 text-center text-2xl font-bold tracking-wide outline-none focus:border-blue-400 dark:border-gray-600 dark:bg-gray-900 dark:text-white sm:text-3xl"
        />
        <button
          onClick={onSubmit}
          disabled={!value.trim() || disabled}
          className="mt-3 w-full rounded-xl bg-blue-600 py-4 text-lg font-bold text-white transition hover:bg-blue-700 active:scale-95 disabled:opacity-40"
        >
          ✓ 確認答案
        </button>
      </div>
    )
  }

  // ============ 數字模式：數字鍵盤 ============
  return (
    <div className="mx-auto w-full max-w-[280px] sm:max-w-xs">
      {/* 輸入顯示 */}
      <div className="mb-3 flex h-14 items-center justify-center rounded-xl border-2 border-neutral-200 bg-white px-4 dark:border-gray-600 dark:bg-gray-900 sm:mb-4 sm:h-16">
        <span className="text-3xl font-bold tracking-widest text-neutral-800 dark:text-white sm:text-4xl">
          {value || <span className="text-neutral-300 dark:text-gray-600">?</span>}
        </span>
      </div>

      {/* 鍵盤 */}
      <div className="flex flex-col gap-1.5 sm:gap-2">
        {keys.map((row, ri) => (
          <div key={ri} className="flex gap-1.5 sm:gap-2">
            {row.map((k, ci) => {
              return (
                <button
                  key={ci}
                  onClick={() => handleKey(k)}
                  disabled={disabled}
                  className={`flex-1 rounded-xl py-3 text-xl font-bold transition active:scale-95 sm:py-4 sm:text-2xl ${
                    k === '⌫'
                      ? 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                      : k === '.'
                      ? 'bg-white text-neutral-800 shadow-sm border border-neutral-200 hover:border-blue-400 hover:bg-blue-50 dark:bg-gray-900 dark:text-white dark:border-gray-600 dark:hover:border-blue-400 dark:hover:bg-blue-950'
                      : 'bg-white text-neutral-800 shadow-sm border border-neutral-200 hover:border-blue-400 hover:bg-blue-50 dark:bg-gray-900 dark:text-white dark:border-gray-600 dark:hover:border-blue-400 dark:hover:bg-blue-950'
                  } disabled:opacity-40`}
                >
                  {k === '⌫' ? '⌫' : k}
                </button>
              )
            })}
          </div>
        ))}

        {/* 清空 + 確認 */}
        <div className="mt-2 flex gap-1.5 sm:gap-2">
          <button
            onClick={handleClear}
            disabled={disabled || !value}
            className="flex-1 rounded-xl bg-neutral-100 py-4 text-base font-bold text-neutral-500 transition hover:bg-neutral-200 active:scale-95 disabled:opacity-40 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 sm:text-lg"
          >
            清空
          </button>
          <button
            onClick={onSubmit}
            disabled={!value || disabled}
            className="flex-[2] rounded-xl bg-blue-600 py-4 text-lg font-bold text-white transition hover:bg-blue-700 active:scale-95 disabled:opacity-40"
          >
            ✓ 確認答案
          </button>
        </div>
      </div>
    </div>
  )
}
