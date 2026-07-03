'use client'

import { useState, useTransition } from 'react'
import { useActionState } from 'react'
import { refreshCaptchaAction } from '@/actions/auth'

type Captcha = { question: string; token: string }

type Props = {
  serverCaptcha: Captcha
}

/**
 * CAPTCHA 挑戰元件
 *
 * 功能：
 *  - 顯示數學驗證題（加/減法）
 *  - 內含隱藏欄位 captchaToken（簽名後的 JWT）
 *  - 「換一題」按鈕由使用者主動重新產生題目
 *
 * 實作要點：
 *  - useActionState 確保 server action 正確綁定（不經 prop 傳遞）
 *  - 顯示的 captcha 為 captchaResult ?? serverCaptcha，無需額外同步 state
 *  - 「render 期間調整 state」偵測 refresh 真正完成，無 useEffect lint 警告
 *  - key=captcha.token 確保換題時 input 重新掛載（自動清空答案）
 */
export default function CaptchaChallenge({ serverCaptcha }: Props) {
  const [refreshing, setRefreshing] = useState(false)
  const [, startTransition] = useTransition()
  const [captchaResult, formAction] = useActionState(refreshCaptchaAction, undefined)
  const [lastResultToken, setLastResultToken] = useState<string | undefined>()

  // 顯示的 captcha：refresh 結果優先，否則回退到伺服器 prop
  const captcha = captchaResult ?? serverCaptcha

  // 偵測 captchaResult 真正更新（token 不同）→ refresh 完成
  if (captchaResult && captchaResult.token !== lastResultToken) {
    setLastResultToken(captchaResult.token)
    setRefreshing(false)
  }

  function handleRefresh() {
    setRefreshing(true)
    startTransition(() => {
      formAction(new FormData())
    })
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-gray-600 dark:bg-gray-800">
      <input type="hidden" name="captchaToken" value={captcha.token} />

      <div className="mb-1 flex items-center justify-between">
        <label className="block text-sm font-medium text-neutral-600 dark:text-gray-300">
          🤖 請回答驗證問題
        </label>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          title="換一題"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50 disabled:opacity-60 dark:text-blue-400 dark:hover:bg-blue-950"
        >
          <span className={refreshing ? 'inline-block animate-spin' : ''}>🔄</span>
          {refreshing ? '更新中…' : '換一題'}
        </button>
      </div>

      <p className="mb-2 text-center text-lg font-bold">{captcha.question}</p>

      {/* key=captcha.token 確保換題時 React 重新掛載 input，自然清空 */}
      <input
        key={captcha.token}
        name="captchaAnswer"
        type="number"
        placeholder="輸入答案"
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-center text-lg outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        required
      />
    </div>
  )
}
