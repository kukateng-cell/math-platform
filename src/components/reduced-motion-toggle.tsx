'use client'

import { useState, useEffect } from 'react'

export default function ReducedMotionToggle() {
  const [reduced, setReduced] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('reduced-motion') === 'true'
    setReduced(stored)
    document.documentElement.classList.toggle('reduce-motion', stored)
  }, [])

  function toggle() {
    const next = !reduced
    setReduced(next)
    localStorage.setItem('reduced-motion', String(next))
    document.documentElement.classList.toggle('reduce-motion', next)
  }

  // 避免 hydration mismatch：只在 client mount 後才顯示
  if (!mounted) {
    return <div className="h-8 w-8" aria-hidden="true" />
  }

  return (
    <button
      onClick={toggle}
      className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none transition hover:bg-neutral-100"
      aria-label={reduced ? '關閉減少動畫模式' : '開啟減少動畫模式'}
      aria-pressed={reduced}
      title={reduced ? '動畫已減少 🌿（點擊恢復）' : '動畫正常 🌸（點擊減少）'}
    >
      {reduced ? '🌿' : '🌸'}
    </button>
  )
}
