'use client'

import { useState, useEffect } from 'react'
import { Icon, type IconName } from './icon'

export default function ReducedMotionToggle() {
  const [reduced, setReduced] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    try {
      const stored = localStorage.getItem('reduced-motion') === 'true'
      setReduced(stored)
      document.documentElement.classList.toggle('reduce-motion', stored)
    } catch {
      // localStorage 不可用（私密瀏覽等），忽略
    }
  }, [])

  function toggle() {
    const next = !reduced
    setReduced(next)
    try {
      localStorage.setItem('reduced-motion', String(next))
    } catch {
      // 儲存失敗，不影響功能
    }
    document.documentElement.classList.toggle('reduce-motion', next)
  }

  // 避免 hydration mismatch：只在 client mount 後才顯示
  if (!mounted) {
    return <div className="h-8 w-8" aria-hidden="true" />
  }

  const icon: IconName = reduced ? 'leaf' : 'flower'

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 transition hover:bg-neutral-100 dark:text-gray-300 dark:hover:bg-gray-800"
      aria-label={reduced ? '關閉減少動畫模式' : '開啟減少動畫模式'}
      aria-pressed={reduced}
      title={reduced ? '動畫已減少（點擊恢復）' : '動畫正常（點擊減少）'}
    >
      <Icon name={icon} className="h-5 w-5" />
    </button>
  )
}
