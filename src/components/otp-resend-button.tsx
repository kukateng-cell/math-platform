'use client'

import { useEffect, useState } from 'react'

type Props = {
  // 綁定到 OTP 步驟的臨時 token（驗證碼階段識別用）
  tempToken: string
  // 重發 server action 的 useActionState 結果（由父層管理）
  resendState?: { message?: string; devOtp?: string; otpRequired?: boolean; error?: string; tempToken?: string }
  // useActionState 回傳的 form action
  resendAction: (payload: FormData) => void
  // 是否 pending
  resendPending: boolean
  // 首次進入 OTP 模式時已發送的 OTP（開發模式顯示）
  initialDevOtp?: string
}

const COOLDOWN_SECONDS = 60

/**
 * OTP「換一組驗證碼」元件
 *
 * 功能：
 *  - 60 秒倒數（首次進入 OTP 模式即開始）
 *  - 倒數結束後顯示「🔄 換一組驗證碼」按鈕，點擊呼叫 server action 重發
 *  - 開發模式下顯示最新的 OTP（重發後自動更新）
 *
 * 注意：useActionState 由父層管理（解決 server action 經 prop 傳遞可能失效的問題），
 *       此元件只接收結果狀態與 action callback。
 */
export default function OtpResendButton({ tempToken, resendState, resendAction, resendPending, initialDevOtp }: Props) {
  const [countdown, setCountdown] = useState(COOLDOWN_SECONDS)

  // 當伺服器回傳新的 resend 結果（重發成功）→ 重設倒數
  // 使用 React 官方推薦的「render 期間調整 state」寫法
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (resendState?.otpRequired && countdown === 0) {
    setCountdown(COOLDOWN_SECONDS)
  }

  // 倒數 interval：每秒 -1，到 0 停住
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((p) => (p > 0 ? p - 1 : 0))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // 顯示最新的 OTP：重發後的優先，否則用初始的
  const shownDevOtp = resendState?.devOtp ?? initialDevOtp

  return (
    <div className="flex flex-col items-center gap-3">
      {/* 開發模式：顯示最新驗證碼 */}
      {shownDevOtp && (
        <div className="w-full rounded-xl bg-blue-50/80 px-4 py-3 text-center dark:bg-white/5">
          <p className="mb-1 text-xs text-blue-500 dark:text-blue-400">🔧 開發模式 — 最新驗證碼</p>
          <p className="select-all text-3xl font-bold tracking-[0.3em] text-blue-900 dark:text-blue-100">
            {shownDevOtp}
          </p>
          <button
            type="button"
            onClick={() => {
              const input = document.getElementById('otpCode') as HTMLInputElement | null
              if (input) {
                input.value = shownDevOtp
                input.dispatchEvent(new Event('input', { bubbles: true }))
              }
            }}
            className="mt-2 rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            一鍵填入
          </button>
        </div>
      )}

      {/* 重發伺服器回應訊息（例如冷卻提示） */}
      {resendState?.message && !resendState.devOtp && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{resendState.message}</p>
      )}

      {/* 倒數 / 重發按鈕 */}
      <div className="text-center">
        {countdown > 0 ? (
          <p className="text-xs text-neutral-400 dark:text-gray-500">
            未收到驗證碼？{countdown} 秒後可重新發送
          </p>
        ) : (
          <form action={resendAction}>
            <input type="hidden" name="tempToken" value={tempToken} />
            <button
              type="submit"
              disabled={resendPending}
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 transition hover:text-blue-800 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <span className={resendPending ? 'inline-block animate-spin' : ''}>🔄</span>
              {resendPending ? '發送中…' : '換一組驗證碼'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
