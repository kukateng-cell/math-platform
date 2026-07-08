import 'server-only'

// ============ 統一的 JWT 簽名金鑰管理 ============
// 所有需要 JWT 簽章/驗證的模組（session、child-session、captcha）共用同一金鑰。
//
// 安全規定：SESSION_SECRET 必須由環境變數提供，嚴禁使用 fallback 預設值。
// 若未設定，啟動時直接拋錯（fail-fast），避免在生產環境用弱金鑰簽發 session。
//
// 產生方式：openssl rand -base64 32

let cachedKey: Uint8Array | null = null
let cachedOtpKey: Uint8Array | null = null

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

// ============ OTP HMAC 專用金鑰（與 JWT 簽名金鑰隔離）============
// 為了防止 SESSION_SECRET 外洩時 OTP HMAC 也同時失效，
// OTP 使用獨立的 OTP_SECRET 環境變數。
// 若未設定，從 SESSION_SECRET 衍生出不同金鑰（用不同 prefix 避免金鑰重用）。
//
// 注意：OTP_SECRET 也是 HMAC 金鑰，建議用獨立的隨機字串。
// 產生方式：openssl rand -base64 32
export function getOtpKey(): Uint8Array {
  if (cachedOtpKey) return cachedOtpKey

  const otpSecret = process.env.OTP_SECRET
  if (otpSecret) {
    cachedOtpKey = new TextEncoder().encode(otpSecret)
    return cachedOtpKey
  }

  // 沒有獨立 OTP_SECRET 時，從 SESSION_SECRET 衍生（用不同 context）
  const sessionSecret = process.env.SESSION_SECRET
  if (!sessionSecret) {
    throw new Error(
      'SESSION_SECRET or OTP_SECRET is not set. Add it to .env (use: openssl rand -base64 32)'
    )
  }
  cachedOtpKey = new TextEncoder().encode('otp-hmac-key:' + sessionSecret)
  return cachedOtpKey
}
