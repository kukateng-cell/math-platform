import 'server-only'

// ============ 統一的 JWT 簽名金鑰管理 ============
// 所有需要 JWT 簽章/驗證的模組（session、child-session、otp、captcha）共用同一金鑰。
//
// 安全規定：SESSION_SECRET 必須由環境變數提供，嚴禁使用 fallback 預設值。
// 若未設定，啟動時直接拋錯（fail-fast），避免在生產環境用弱金鑰簽發 session。
//
// 產生方式：openssl rand -base64 32

let cachedKey: Uint8Array | null = null

export function getSessionKey(): Uint8Array {
  if (cachedKey) return cachedKey

  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error(
      'SESSION_SECRET is not set. Add it to .env (use: openssl rand -base64 32)'
    )
  }
  cachedKey = new TextEncoder().encode(secret)
  return cachedKey
}
