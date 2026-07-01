import { SignJWT, jwtVerify } from 'jose'

const SECRET = process.env.SESSION_SECRET || 'fallback-secret'
const KEY = new TextEncoder().encode(SECRET)

// 產生 6 位數驗證碼，存入記憶體（正式環境應改用 Redis）
const otpStore = new Map<string, { code: string; expiresAt: number }>()

export function generateOtp(userId: string): string {
  const code = String(Math.floor(100000 + Math.random() * 900000)) // 6 位數
  otpStore.set(userId, { code, expiresAt: Date.now() + 5 * 60 * 1000 }) // 5 分鐘有效
  return code
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
