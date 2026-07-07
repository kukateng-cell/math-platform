import { SignJWT, jwtVerify } from 'jose'
import { getSessionKey } from '@/lib/secret'

const KEY = getSessionKey()

const OTP_EXPIRY_MS = 5 * 60 * 1000  // 5 分鐘
const RESEND_COOLDOWN_MS = 60 * 1000  // 60 秒冷卻

// 產生 6 位數驗證碼，存入記憶體（正式環境應改用 Redis）
const otpStore = new Map<string, { code: string; expiresAt: number; resentAt: number }>()

export function generateOtp(userId: string): string {
  const code = String(Math.floor(100000 + Math.random() * 900000)) // 6 位數
  otpStore.set(userId, { code, expiresAt: Date.now() + OTP_EXPIRY_MS, resentAt: Date.now() })
  return code
}

// 檢查是否在冷卻期內（60 秒內不可重發）
export function canResendOtp(userId: string): boolean {
  const entry = otpStore.get(userId)
  if (!entry) return true // 沒有紀錄代表可發
  const elapsed = Date.now() - entry.resentAt
  return elapsed >= RESEND_COOLDOWN_MS
}

// 取得剩餘冷卻秒數
export function getResendCooldownSeconds(userId: string): number {
  const entry = otpStore.get(userId)
  if (!entry) return 0
  const remaining = RESEND_COOLDOWN_MS - (Date.now() - entry.resentAt)
  return Math.max(0, Math.ceil(remaining / 1000))
}

export function verifyOtp(userId: string, code: string): boolean {
  const entry = otpStore.get(userId)
  if (!entry) return false
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(userId)
    return false
  }
  if (entry.code !== code.trim()) return false
  otpStore.delete(userId) // 一次性使用
  return true
}

// 產生短期授權 token（密碼驗證通過後、OTP 完成前使用）
export async function createTempToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(KEY)
}

// 驗證並取出 userId
export async function verifyTempToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, KEY, { algorithms: ['HS256'] })
    return (payload as { userId: string }).userId ?? null
  } catch {
    return null
  }
}
