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
  // 用 touch 事件補償 React 在 mobile 上點擊位置不準的問題
  const isDragging = useRef(false)

  const marks = useMemo(() => {
    const arr: number[] = []
    for (let i = min; i <= max; i++) arr.push(i)
    return arr
  }, [min, max])

  function getValueFromEvent(e: React.MouseEvent | React.TouchEvent) {
    const rect = barRef.current!.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(min + ratio * (max - min))
  }

  function handleInteraction(e: React.MouseEvent | React.TouchEvent) {
    if (disabled) return
    const val = getValueFromEvent(e)
    onChange(Math.max(min, Math.min(max, val)))
  }

  return (
    <div className="w-full px-2 py-4 sm:py-6" role="slider" aria-label={`數字線 ${min} 到 ${max}`} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value ?? min} tabIndex={0}
      onKeyDown={(e) => {
        if (disabled) return
        const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
        if (step) { e.preventDefault(); onChange(Math.max(min, Math.min(max, (value ?? min) + step))) }
      }}
    >
      <div
        ref={barRef}
        onClick={handleInteraction}
        onTouchStart={(e) => { isDragging.current = true; handleInteraction(e) }}
        onTouchMove={(e) => { if (isDragging.current) handleInteraction(e) }}
        onTouchEnd={() => { isDragging.current = false }}
        className={`relative w-full py-6 ${disabled ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
      >
        {/* 背景線 — 加粗更容易點擊 */}
        <div className="h-3 rounded-full bg-neutral-200 dark:bg-gray-700" />

        {/* 刻度與標籤 */}
        <div className="relative" style={{ height: '28px' }}>
          {marks.map((m) => {
            const pct = ((m - min) / (max - min)) * 100
            return (
              <div
                key={m}
                className="absolute flex flex-col items-center"
                style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
              >
                <div className="mb-1 h-3 w-0.5 bg-neutral-300 dark:bg-gray-600" />
                <span className={`text-xs select-none sm:text-sm ${m === value ? 'font-bold text-blue-600' : 'text-neutral-400 dark:text-gray-500'}`}>{m}</span>
              </div>
            )
          })}
        </div>

        {/* 選中標記 */}
        {value !== null && (
          <div
            className="absolute top-1/2 flex -translate-y-1/2 flex-col items-center transition-all duration-200 pointer-events-none"
            style={{ left: `${((value - min) / (max - min)) * 100}%`, transform: 'translate(-50%, -50%)' }}
          >
            <div className="h-8 w-8 rounded-full border-4 border-blue-500 bg-white shadow-md dark:bg-gray-300 sm:h-10 sm:w-10" aria-hidden="true" />
            <span className="mt-1 text-sm font-bold text-blue-600 sm:text-base" aria-live="polite">{value}</span>
          </div>
        )}
      </div>

      {/* 最小值/最大值標籤 */}
      <div className="flex justify-between px-1 text-xs text-neutral-400 dark:text-gray-500 sm:text-sm">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}
