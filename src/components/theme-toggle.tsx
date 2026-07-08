'use client'

import { useState, useEffect, useCallback } from 'react'
import { Icon, type IconName } from './icon'

type Theme = 'light' | 'dark' | 'system'

const THEME_KEY = 'theme'
// 點擊循環順序：跟隨系統 → 白天 → 夜間 → 跟隨系統
const ORDER: Theme[] = ['system', 'light', 'dark']

function applyTheme(theme: Theme) {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    try {
      const stored = (localStorage.getItem(THEME_KEY) as Theme) || 'system'
      setTheme(stored)
      applyTheme(stored)
    } catch {
      // localStorage 不可用（私密瀏覽等），忽略
    }

    // 系統主題變化時，若處於「跟隨系統」模式則同步更新
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const current = (localStorage.getItem(THEME_KEY) as Theme) || 'system'
      if (current === 'system') applyTheme('system')
    }
    mql.addEventListener('change', onChange)

    // 跨分頁同步
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY && e.newValue) {
        const next = e.newValue as Theme
        setTheme(next)
        applyTheme(next)
      }
    }
    window.addEventListener('storage', onStorage)

    return () => {
      mql.removeEventListener('change', onChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const cycle = useCallback(() => {
    setTheme((prev) => {
      const next = ORDER[(ORDER.indexOf(prev) + 1) % ORDER.length]
      try {
        localStorage.setItem(THEME_KEY, next)
      } catch {
        // 儲存失敗，不影響功能
      }
      applyTheme(next)
      return next
    })
  }, [])

  // 避免 hydration mismatch：與 ReducedMotionToggle 同樣只在 mount 後顯示
  if (!mounted) {
    return <div className="h-8 w-8" aria-hidden="true" />
  }

  const icon: IconName = theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'laptop'
  const label =
    theme === 'light'
      ? '目前：白天模式（點擊切換為夜間模式）'
      : theme === 'dark'
        ? '目前：夜間模式（點擊切換為跟隨系統）'
        : '目前：跟隨系統（點擊切換為白天模式）'

  return (
    <button
      type="button"
      onClick={cycle}
      className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 transition hover:bg-neutral-100 dark:text-gray-300 dark:hover:bg-gray-800"
      aria-label={label}
      aria-pressed={theme === 'dark'}
      title={label}
    >
      <Icon name={icon} className="h-5 w-5" />
    </button>
  )
}
