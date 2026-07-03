'use client'

type Props = {
  value: string
  onChange: (val: string) => void
  onSubmit: () => void
  disabled?: boolean
}

export default function NumberPad({ value, onChange, onSubmit, disabled }: Props) {
  const keys = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    ['', 0, '⌫'],
  ]

  function handleKey(k: number | string) {
    if (disabled) return
    if (k === '⌫') {
      onChange(value.slice(0, -1))
    } else if (typeof k === 'number') {
      if (value.length >= 3) return // 最多 3 位數
      onChange(value + String(k))
    }
  }

  return (
    <div className="mx-auto w-full max-w-xs">
      {/* 輸入顯示 */}
      <div className="mb-4 flex h-16 items-center justify-center rounded-xl border-2 border-neutral-200 bg-white px-4 dark:border-gray-600 dark:bg-gray-900">
        <span className="text-4xl font-bold tracking-widest text-neutral-800 dark:text-white">
          {value || <span className="text-neutral-300 dark:text-gray-600">?</span>}
        </span>
      </div>

      {/* 鍵盤 */}
      <div className="flex flex-col gap-2">
        {keys.map((row, ri) => (
          <div key={ri} className="flex gap-2">
            {row.map((k, ci) => {
              if (k === '') {
                return <div key={ci} className="flex-1" />
              }
              return (
                <button
                  key={ci}
                  onClick={() => handleKey(k)}
                  disabled={disabled}
                  className={`flex-1 rounded-xl py-4 text-2xl font-bold transition active:scale-95 ${
                    k === '⌫'
                      ? 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                      : 'bg-white text-neutral-800 shadow-sm border border-neutral-200 hover:border-blue-400 hover:bg-blue-50 dark:bg-gray-900 dark:text-white dark:border-gray-600 dark:hover:border-blue-400 dark:hover:bg-blue-950'
                  } disabled:opacity-40`}
                >
                  {k === '⌫' ? '⌫' : k}
                </button>
              )
            })}
          </div>
        ))}

        <button
          onClick={onSubmit}
          disabled={!value || disabled}
          className="mt-2 w-full rounded-xl bg-blue-600 py-4 text-lg font-bold text-white transition hover:bg-blue-700 active:scale-95 disabled:opacity-40"
        >
          ✓ 確認答案
        </button>
      </div>
    </div>
  )
}
