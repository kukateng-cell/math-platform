'use client'

import { useEffect, useRef } from 'react'
import { Icon } from './icon'

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
    } else if (k === '-') {
      // 正負切換：已有負號則移除，否則加上
      if (value.startsWith('-')) {
        onChange(value.slice(1))
      } else {
        onChange('-' + value)
      }
    }
  }

  // 清空全部
  function handleClear() {
    if (disabled) return
    onChange('')
  }

  // 數字模式 input：不過濾任何字元，支援中文、符號等所有輸入
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (disabled) return
    onChange(e.target.value)
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

  // 數字模式實體鍵盤：僅攔截 Backspace 和 Enter，其餘放行給 input 處理
  useEffect(() => {
    if (mode !== 'numeric') return
    function onKey(e: KeyboardEvent) {
      if (disabled) return
      // 只攔截 Backspace（退格）和 Enter（送出）
      if (e.key === 'Enter') {
        // 輸入法組字中不攔截，避免誤送出
        if (e.isComposing || e.keyCode === 229) return
        e.preventDefault()
        if (value) onSubmit()
      }
      // 其餘按鍵（數字、字母、符號、中文等）全部放行給 input 原生的 onChange
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, disabled, value, onSubmit])

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
          <span className="inline-flex items-center gap-1.5"><Icon name="check" className="h-5 w-5" />確認答案</span>
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
                  {k === '⌫' ? <Icon name="backspace" className="mx-auto h-6 w-6" /> : k}
                </button>
              )
            })}
          </div>
        ))}

        {/* 正負切換 + 清空 + 確認 */}
        <div className="mt-2 flex gap-1.5 sm:gap-2">
          <button
            onClick={() => handleKey('-')}
            onMouseDown={(e) => e.preventDefault()}
            disabled={disabled}
            aria-label="正負切換"
            className="flex-1 rounded-xl border border-neutral-200 bg-white py-3 text-lg font-bold shadow-sm transition hover:border-blue-400 hover:bg-blue-50 active:scale-95 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:hover:border-blue-400 dark:hover:bg-blue-950"
          >
            {value.startsWith('-') ? '+/-' : '-/-'}
          </button>
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
            <span className="inline-flex items-center gap-1.5"><Icon name="check" className="h-5 w-5" />確認答案</span>
          </button>
        </div>
      </div>
    </div>
  )
}
