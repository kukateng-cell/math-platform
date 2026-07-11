'use client'

import { useEffect, useRef } from 'react'

/**
 * Cloudflare Turnstile CAPTCHA widget
 *
 * 正式環境使用 Turnstile 取代算術 CAPTCHA。
 * 需在 .env 設定 TURNSTILE_SITE_KEY 與 TURNSTILE_SECRET_KEY。
 * 開發環境無 Turnstile key 時自動降級為算術 CAPTCHA（不渲染此元件）。
 *
 * 用法：
 *   <TurnstileWidget onToken={(t) => setTurnstileToken(t)} />
 */
type Props = {
  /** Turnstile token 就緒時回呼 */
  onToken: (token: string) => void
  /** 重設時回呼（可選） */
  onExpire?: () => void
}

export default function TurnstileWidget({ onToken, onExpire }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const calledRef = useRef(false)

  useEffect(() => {
    // 只在 Turnstile 啟用時渲染
    if (typeof window === 'undefined') return
    if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return

    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

    // 動態載入 Turnstile script（僅一次）
    if (!(window as unknown as Record<string, unknown>).turnstile) {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    const checkTurnstile = () => {
      const ts = (window as unknown as { turnstile?: { render: (el: string | HTMLElement, opts: Record<string, unknown>) => string } }).turnstile
      if (!ts || !containerRef.current) {
        setTimeout(checkTurnstile, 200)
        return
      }
      // 避免重複 render
      if (widgetIdRef.current) return

      calledRef.current = false
      widgetIdRef.current = ts.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => {
          if (!calledRef.current) {
            calledRef.current = true
            onToken(token)
          }
        },
        'expired-callback': () => {
          calledRef.current = false
          onExpire?.()
        },
      })
    }

    checkTurnstile()

    return () => {
      // cleanup
      widgetIdRef.current = null
      calledRef.current = false
    }
  }, [onToken, onExpire])

  // 無 Turnstile key 時不渲染
  if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    return null
  }

  return <div ref={containerRef} className="flex justify-center" />
}
