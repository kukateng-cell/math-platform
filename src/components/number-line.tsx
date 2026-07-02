'use client'

import { useRef, useMemo } from 'react'

type Props = {
  min: number
  max: number
  value: number | null
  onChange: (val: number) => void
  disabled?: boolean
}

export default function NumberLine({ min, max, value, onChange, disabled }: Props) {
  const barRef = useRef<HTMLDivElement>(null)

  const marks = useMemo(() => {
    const arr: number[] = []
    for (let i = min; i <= max; i++) arr.push(i)
    return arr
  }, [min, max])

  function handleClick(e: React.MouseEvent) {
    if (disabled) return
    const rect = barRef.current!.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const val = Math.round(min + ratio * (max - min))
    onChange(Math.max(min, Math.min(max, val)))
  }

  return (
    <div className="w-full px-2 py-6">
      <div
        ref={barRef}
        onClick={handleClick}
        className={`relative w-full cursor-pointer py-4 ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      >
        {/* 背景線 */}
        <div className="h-2 rounded-full bg-neutral-200 dark:bg-gray-700" />

        {/* 刻度與標籤 */}
        <div className="relative mt-1" style={{ height: '24px' }}>
          {marks.map((m) => {
            const pct = ((m - min) / (max - min)) * 100
            return (
              <div
                key={m}
                className="absolute flex flex-col items-center"
                style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
              >
                <div className="mb-1 h-2 w-0.5 bg-neutral-300 dark:bg-gray-600" />
                <span className="text-xs text-neutral-400 select-none dark:text-gray-500">{m}</span>
              </div>
            )
          })}
        </div>

        {/* 選中標記 */}
        {value !== null && (
          <div
            className="absolute top-1/2 flex -translate-y-1/2 flex-col items-center transition-all duration-200"
            style={{ left: `${((value - min) / (max - min)) * 100}%`, transform: 'translate(-50%, -50%)' }}
          >
            <div className="h-7 w-7 rounded-full border-4 border-blue-500 bg-white shadow-md dark:bg-gray-300" />
            <span className="mt-1 text-sm font-bold text-blue-600">{value}</span>
          </div>
        )}
      </div>

      {/* 最小值/最大值標籤 */}
      <div className="flex justify-between px-0.5 text-xs text-neutral-400 dark:text-gray-500">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}
