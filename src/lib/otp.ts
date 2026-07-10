import { SignJWT, jwtVerify } from 'jose'
import { createHmac } from 'crypto'
import { getSessionKey } from '@/lib/secret'
import { prisma } from '@/lib/prisma'

const KEY = getSessionKey()

const OTP_EXPIRY_MS = 5 * 60 * 1000  // 5 分鐘
const RESEND_COOLDOWN_MS = 60 * 1000  // 60 秒冷卻

// ============ OTP code 雜湊 ============
// OTP 明文只在產生時短暫存在於記憶體中用來寄信；存入 DB 與記憶體備援
// 一律存 HMAC-SHA256(hex)。即使 DB 外洩，攻擊者也無法直接看到驗證碼。
function hashOtp(code: string): string {
  return createHmac('sha256', KEY).update(code).digest('hex')
}

// ============ OTP 驗證碼（優先使用 DB，降級至記憶體）============
// 若 OtpCode 表尚未建立，自動降級至記憶體 Map 確保功能正常。

// 記憶體備援（value 為 hash 後的 code）
const memoryOtpStore = new Map<string, { codeHash: string; expiresAt: number; resentAt: number }>()

let otpDbAvailable: boolean | null = null

async function otpIsDbAvailable(): Promise<boolean> {
  if (otpDbAvailable !== null) return otpDbAvailable
  try {
    await prisma.otpCode.findFirst()
    otpDbAvailable = true
  } catch {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[OTP] DB table not available in production')
    }
    console.warn('[OTP] DB table not available, falling back to in-memory')
    otpDbAvailable = false
  }
  return otpDbAvailable
}

// 產生 6 位數驗證碼
export async function generateOtp(identifier: string): Promise<string> {
  const code = String(Math.floor(100000 + Math.random() * 900000)) // 6 位數
  const now = new Date()

  if (await otpIsDbAvailable()) {
    try {
      await prisma.otpCode.deleteMany({ where: { identifier } })
      await prisma.otpCode.create({
        data: {
          identifier,
          code: hashOtp(code),  // 存 HMAC 雜湊，不存明文
          expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS),
          resentAt: now,
        },
      })
      return code
    } catch {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('[OTP] DB write failed in production')
      }
      otpDbAvailable = null
    }
  }

  // 記憶體備援
  memoryOtpStore.set(identifier, { codeHash: hashOtp(code), expiresAt: Date.now() + OTP_EXPIRY_MS, resentAt: Date.now() })
  return code
}

// 檢查是否在冷卻期內（60 秒內不可重發）
export async function canResendOtp(identifier: string): Promise<boolean> {
  if (await otpIsDbAvailable()) {
    try {
      const entry = await prisma.otpCode.findFirst({
        where: { identifier },
        orderBy: { createdAt: 'desc' },
      })
      if (!entry) return true
      return Date.now() - entry.resentAt.getTime() >= RESEND_COOLDOWN_MS
    } catch {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('[OTP] DB read failed in production')
      }
      otpDbAvailable = null
    }
  }
  const entry = memoryOtpStore.get(identifier)
  if (!entry) return true
  return Date.now() - entry.resentAt >= RESEND_COOLDOWN_MS
}

// 取得剩餘冷卻秒數
export async function getResendCooldownSeconds(identifier: string): Promise<number> {
  if (await otpIsDbAvailable()) {
    try {
      const entry = await prisma.otpCode.findFirst({
        where: { identifier },
        orderBy: { createdAt: 'desc' },
      })
      if (!entry) return 0
      const remaining = RESEND_COOLDOWN_MS - (Date.now() - entry.resentAt.getTime())
      return Math.max(0, Math.ceil(remaining / 1000))
    } catch {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('[OTP] DB read failed in production')
      }
      otpDbAvailable = null
    }
  }
  const entry = memoryOtpStore.get(identifier)
  if (!entry) return 0
  const remaining = RESEND_COOLDOWN_MS - (Date.now() - entry.resentAt)
  return Math.max(0, Math.ceil(remaining / 1000))
}

// 驗證 OTP：過期或錯誤回傳 false，成功則刪除（一次性）
export async function verifyOtp(identifier: string, code: string): Promise<boolean> {
  if (await otpIsDbAvailable()) {
    try {
      const entry = await prisma.otpCode.findFirst({
        where: { identifier },
        orderBy: { createdAt: 'desc' },
      })
      if (!entry) return false
      if (Date.now() > entry.expiresAt.getTime()) {
        await prisma.otpCode.delete({ where: { id: entry.id } })
        return false
      }
      // 常數時間比較，避免 timing 攻擊
      const candidate = hashOtp(code.trim())
      if (candidate !== entry.code) return false
      await prisma.otpCode.delete({ where: { id: entry.id } }) // 一次性使用
      return true
    } catch {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('[OTP] DB read failed in production')
      }
      otpDbAvailable = null
    }
  }
  const entry = memoryOtpStore.get(identifier)
  if (!entry) return false
  if (Date.now() > entry.expiresAt) {
    memoryOtpStore.delete(identifier)
    return false
  }
  const candidate = hashOtp(code.trim())
  if (candidate !== entry.codeHash) return false
  memoryOtpStore.delete(identifier) // 一次性使用
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

// ====================================================================
// 密碼重設授權 token（綁定 PasswordResetGrant，含 tokenVersion 防重放）
// --------------------------------------------------------------------
// 與一般 tempToken 的差異：
//   - 夾帶 jti（= PasswordResetGrant.id）與 tokenVersion（簽發當下快照）。
//   - resetPassword 驗證時會比對 DB grant 是否未消耗、tokenVersion 是否一致。
//   - purpose='reset' 防止與其他用途的 token 互換。
// ====================================================================
export type PasswordResetTokenPayload = {
  userId: string
  jti: string // 對應 PasswordResetGrant.id
  tokenVersion: number
}

export async function createPasswordResetToken(payload: PasswordResetTokenPayload): Promise<string> {
  return new SignJWT({ ...payload, purpose: 'reset' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(KEY)
}

export async function verifyPasswordResetToken(token: string): Promise<PasswordResetTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, KEY, { algorithms: ['HS256'] })
    if ((payload as { purpose?: string }).purpose !== 'reset') return null
    const p = payload as PasswordResetTokenPayload & { purpose: string }
    if (!p.userId || !p.jti || typeof p.tokenVersion !== 'number') return null
    return { userId: p.userId, jti: p.jti, tokenVersion: p.tokenVersion }
  } catch {
    return null
  }
}

// ====================================================================
// 註冊意圖 token（自主學習學生註冊用）
// --------------------------------------------------------------------
// 安全：自主註冊時「先建立帳號再驗 OTP」會留下大量未驗證的殭屍帳號，
// 也讓攻擊者可用別人 email 佔用帳號。改成把註冊資料簽進 token，
// 通過 OTP 後才在 DB 建立帳號。OTP 期間以 email 為金鑰存於記憶體。
// ====================================================================
export type SignupIntent = {
  email: string
  nickname: string
  gradeLevel: string
}

export async function createSignupToken(intent: SignupIntent): Promise<string> {
  return new SignJWT({ ...intent, purpose: 'signup' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(KEY)
}

export async function verifySignupToken(token: string): Promise<SignupIntent | null> {
  try {
    const { payload } = await jwtVerify(token, KEY, { algorithms: ['HS256'] })
    if ((payload as { purpose?: string }).purpose !== 'signup') return null
    const p = payload as SignupIntent & { purpose: string }
    if (!p.email || !p.nickname || !p.gradeLevel) return null
    return { email: p.email, nickname: p.nickname, gradeLevel: p.gradeLevel }
  } catch {
    return null
  }
}
