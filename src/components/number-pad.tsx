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
  /** 數字模式最多輸入位數（含小數點），預設 10 */
  maxLength?: number
  /** 文字模式 placeholder */
  placeholder?: string
  /** 當前題號（用於題目切換時觸發聚焦） */
  index?: number
}

export default function NumberPad({
  value,
  onChange,
  onSubmit,
  disabled,
  mode = 'numeric',
  maxLength = 10,
  placeholder = '輸入答案',
  index,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const keys: (number | string)[][] = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    ['-', 0, '⌫'],
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
    } else if (k === '-') {
      // 負號：只能出現在開頭，且不能重複
      if (value.startsWith('-')) return // 已有負號 → 移除（切換正負）
      if (value.length >= maxLength) return
      onChange('-' + value)
    }
  }

  // 清空全部
  function handleClear() {
    if (disabled) return
    onChange('')
  }

  // 數字模式 input 過濾：只允許數字、小數點、負號（讓手機/平板系統鍵盤也能輸入）
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (disabled) return
    let raw = e.target.value
    // 保留負號（僅開頭）、數字、小數點
    const hasNeg = raw.startsWith('-')
    raw = raw.replace(/^-/, '').replace(/[^0-9.]/g, '')
    // 小數點只能一個
    const firstDot = raw.indexOf('.')
    if (firstDot !== -1) {
      raw = raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, '')
    }
    if (raw.length > maxLength) raw = raw.slice(0, maxLength)
    onChange((hasNeg ? '-' : '') + raw)
  }

  // 數字模式：每題自動聚焦 input，讓手機/平板鍵盤保持彈出
  // 用 setTimeout 確保 DOM 已完整更新，避免 React batched update 後競態
  useEffect(() => {
    if (mode !== 'numeric') return
    if (disabled) return
    if (value === '') {
      const timer = setTimeout(() => inputRef.current?.focus(), 80)
      return () => clearTimeout(timer)
    }
  }, [mode, disabled, value, index])

  // 數字模式：支援實體鍵盤直接輸入（數字、負號、小數點、退格、Enter 送出）
  useEffect(() => {
    if (mode !== 'numeric') return
    function onKey(e: KeyboardEvent) {
      if (disabled) return

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        if (value.length >= maxLength) return
        onChange(value + e.key)
      } else if (e.key === '.') {
        e.preventDefault()
        if (value.includes('.') || value.length >= maxLength) return
        onChange(value === '' ? '0.' : value + '.')
      } else if (e.key === '-') {
        e.preventDefault()
        if (value.startsWith('-')) {
          onChange(value.slice(1)) // 切換正負
        } else {
          if (value.length >= maxLength) return
          onChange('-' + value)
        }
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

  // ============ 文字模式：直接用輸入框（支援中文輸入法 IME）============
  if (mode === 'text') {
    return (
      <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-3 sm:max-w-sm">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return
            if (e.key === 'Enter') {
              e.preventDefault()
              if (value.trim()) onSubmit()
            }
          }}
          disabled={disabled}
          placeholder={placeholder || '輸入答案（可輸入中文）'}
          maxLength={100}
          data-autofocus-next
          autoFocus
          autoComplete="off"
          enterKeyHint="done"
          style={{ fontSize: '16px' }} /* iOS 防止自動縮放 */
          className="w-full rounded-xl border-2 border-neutral-200 bg-white px-4 py-4 text-center text-2xl font-bold tracking-wide outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-800 sm:text-3xl"
        />
        <button
          onClick={onSubmit}
          disabled={!value.trim() || disabled}
          className="mt-3 w-full rounded-xl bg-blue-600 py-4 text-lg font-bold text-white transition hover:bg-blue-700 active:scale-95 disabled:opacity-40 min-h-[52px]"
        >
          ✓ 確認答案
        </button>
      </div>
    )
  }

  // ============ 數字模式：數字鍵盤 ============
  return (
    <div className="mx-auto w-full max-w-sm sm:max-w-xs">
      {/* 輸入框：使用真實 <input> 讓手機/平板能喚起系統數字鍵盤 */}
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        pattern="[0-9.]*"
        value={value}
        onChange={handleInputChange}
        disabled={disabled}
        autoFocus
        autoComplete="off"
        enterKeyHint="done"
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return
          if (e.key === 'Enter') {
            e.preventDefault()
            if (value) onSubmit()
          }
        }}
        data-autofocus-next
        placeholder="?"
        aria-label="答案輸入框"
        className="mb-4 h-16 w-full rounded-xl border-2 border-neutral-200 bg-white px-4 text-center text-4xl font-bold tracking-widest text-neutral-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-800"
      />

      {/* 鍵盤 */}
      <div className="flex flex-col gap-2">
        {keys.map((row, ri) => (
          <div key={ri} className="flex gap-2">
            {row.map((k, ci) => {
              return (
                <button
                  key={ci}
                  onClick={() => handleKey(k)}
                  onMouseDown={(e) => e.preventDefault()}
                  disabled={disabled}
                  aria-label={k === '⌫' ? '刪除' : k === '.' ? '小數點' : typeof k === 'number' ? `數字 ${k}` : String(k)}
                  className={`flex-1 min-h-[52px] rounded-xl py-3 text-2xl font-bold transition active:scale-95 sm:py-4 ${
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
            onMouseDown={(e) => e.preventDefault()}
            disabled={disabled || !value}
            aria-label="清空"
            className="flex-1 min-h-[52px] rounded-xl bg-neutral-100 py-3 text-base font-bold text-neutral-500 transition hover:bg-neutral-200 active:scale-95 disabled:opacity-40 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 sm:py-4 sm:text-lg"
          >
            清空
          </button>
          <button
            onClick={onSubmit}
            disabled={!value || disabled}
            className="flex-[2] min-h-[52px] rounded-xl bg-blue-600 py-3 text-lg font-bold text-white transition hover:bg-blue-700 active:scale-95 disabled:opacity-40 sm:py-4"
          >
            ✓ 確認答案
          </button>
        </div>
      </div>
    </div>
  )
}
