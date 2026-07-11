import { SignJWT, jwtVerify } from 'jose'
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'crypto'
import { getOtpKey } from '@/lib/secret'
import { prisma } from '@/lib/prisma'

const KEY = getOtpKey()

const OTP_EXPIRY_MS = 5 * 60 * 1000  // 5 分鐘
const RESEND_COOLDOWN_MS = 60 * 1000  // 60 秒冷卻
// P1-1：OTP 最大錯誤嘗試次數，超過後 OTP 自動作廢
const OTP_MAX_ATTEMPTS = 5

// ============ OTP code 雜湊 ============
// OTP 明文只在產生時短暫存在於記憶體中用來寄信；存入 DB 與記憶體備援
// 一律存 HMAC-SHA256(hex)。即使 DB 外洩，攻擊者也無法直接看到驗證碼。
// P1-3：hash 同時包含 identifier + purpose，避免不同流程的 OTP hash 相同、
// 也防止跨流程冒用。
function hashOtp(identifier: string, purpose: string, code: string): string {
  return createHmac('sha256', KEY).update(`${identifier}:${purpose}:${code}`).digest('hex')
}

// ============ OTP 用途（purpose）============
// P1-3：identifier 在不同流程可能相同（例如家長登入與忘記密碼皆以 userId 為
// identifier），必須靠 purpose 區隔。purpose 同時是 OtpCode 聯合唯一鍵的一環、
// 也參與 hash 計算，確保不同流程的 OTP 無法互相覆蓋或冒用。
export type OtpPurpose =
  | 'PARENT_SIGNUP'   // 家長註冊（identifier = email）
  | 'PARENT_LOGIN'    // 家長登入（identifier = userId）
  | 'PASSWORD_RESET'  // 家長忘記密碼（identifier = userId）
  | 'STUDENT_SIGNUP'  // 學生自助註冊（identifier = email）
  | 'STUDENT_LOGIN'   // 學生自助登入（identifier = childId）

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

// 產生 6 位數驗證碼（使用 crypto.randomInt，P2-11）
export async function generateOtp(identifier: string, purpose: OtpPurpose): Promise<string> {
  const code = String(randomInt(100000, 1000000)) // 6 位數
  const now = new Date()
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS)
  const codeHash = hashOtp(identifier, purpose, code)

  if (await otpIsDbAvailable()) {
    try {
      // P1-3：atomic upsert。依賴 @@unique([identifier, purpose])，Prisma 產生
      // 單一 INSERT ... ON CONFLICT 陳述。兩個併發 generateOtp：一個插入成功，
      // 另一個變成 update，DB 中永遠只有一筆有效 OTP（不會有「最新行被刪後
      // 舊行復活」的問題）。同時重置 attemptCount/lockedAt。
      await prisma.otpCode.upsert({
        where: { identifier_purpose: { identifier, purpose } },
        update: {
          code: codeHash,
          expiresAt,
          resentAt: now,
          attemptCount: 0,
          lockedAt: null,
        },
        create: {
          identifier,
          purpose,
          code: codeHash,  // 存 HMAC 雜湊，不存明文
          expiresAt,
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

  // 記憶體備援（key 包含 purpose，避免不同流程互相覆蓋）
  memoryOtpStore.set(`${identifier}:${purpose}`, { codeHash, expiresAt: Date.now() + OTP_EXPIRY_MS, resentAt: Date.now() })
  return code
}

// 檢查是否在冷卻期內（60 秒內不可重發）
export async function canResendOtp(identifier: string, purpose: OtpPurpose): Promise<boolean> {
  if (await otpIsDbAvailable()) {
    try {
      // P1-3：(identifier, purpose) 聯合唯一鍵，最多一筆，直接 findUnique
      const entry = await prisma.otpCode.findUnique({
        where: { identifier_purpose: { identifier, purpose } },
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
  const entry = memoryOtpStore.get(`${identifier}:${purpose}`)
  if (!entry) return true
  return Date.now() - entry.resentAt >= RESEND_COOLDOWN_MS
}

// 取得剩餘冷卻秒數
export async function getResendCooldownSeconds(identifier: string, purpose: OtpPurpose): Promise<number> {
  if (await otpIsDbAvailable()) {
    try {
      const entry = await prisma.otpCode.findUnique({
        where: { identifier_purpose: { identifier, purpose } },
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
  const entry = memoryOtpStore.get(`${identifier}:${purpose}`)
  if (!entry) return 0
  const remaining = RESEND_COOLDOWN_MS - (Date.now() - entry.resentAt)
  return Math.max(0, Math.ceil(remaining / 1000))
}

/** 常數時間比較兩個 hex 字串（HMAC-SHA256 輸出長度固定 64 hex chars） */
function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

// 驗證 OTP：過期或錯誤回傳 false，成功則刪除（一次性）
// P1-1：加入 attemptCount 與 lockedAt 檢查。錯誤達上限即作廢並鎖定。
// P1-3：
//   - 錯誤次數使用 atomic increment（{ increment: 1 }），併發錯誤嘗試不會低估。
//   - 驗證成功使用 conditional deleteMany（同時比對 id 與 code），確保併發下
//     只有最先完成的那一個請求成功，其餘回傳 false（OTP 一次性消耗）。
export async function verifyOtp(identifier: string, purpose: OtpPurpose, code: string): Promise<boolean> {
  if (await otpIsDbAvailable()) {
    try {
      const entry = await prisma.otpCode.findUnique({
        where: { identifier_purpose: { identifier, purpose } },
      })
      if (!entry) return false
      if (Date.now() > entry.expiresAt.getTime()) {
        await prisma.otpCode.deleteMany({ where: { id: entry.id } }).catch(() => {})
        return false
      }
      // P1-1：檢查是否已鎖定（錯誤次數過多）
      if (entry.lockedAt) return false
      if (entry.attemptCount >= OTP_MAX_ATTEMPTS) {
        await prisma.otpCode.update({ where: { id: entry.id }, data: { lockedAt: new Date() } }).catch(() => {})
        return false
      }
      // P2-11：常數時間比較，避免 timing 攻擊
      const candidate = hashOtp(identifier, purpose, code.trim())
      if (constantTimeEqual(candidate, entry.code)) {
        // P1-3：conditional deleteMany。WHERE id = ? AND code = ?
        //   - 併發的兩個正確驗證：第一個刪除成功（count=1），第二個找不到列（count=0）→ 只成功一次。
        //   - 若 generateOtp 在讀取後又改了 code（重發），code 不相符 → count=0，
        //     舊碼自動失效，不會誤刪新碼。
        const result = await prisma.otpCode.deleteMany({
          where: { id: entry.id, code: entry.code },
        })
        return result.count === 1
      }
      // P1-3：atomic increment，併發錯誤嘗試不會低估次數
      const updated = await prisma.otpCode.update({
        where: { id: entry.id },
        data: { attemptCount: { increment: 1 } },
        select: { attemptCount: true },
      }).catch(() => null)
      // 達上限即鎖定（讀回 increment 後的新值判斷）
      if (updated && updated.attemptCount >= OTP_MAX_ATTEMPTS) {
        await prisma.otpCode.update({
          where: { id: entry.id },
          data: { lockedAt: new Date() },
        }).catch(() => {})
      }
      return false
    } catch {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('[OTP] DB read failed in production')
      }
      otpDbAvailable = null
    }
  }
  const entry = memoryOtpStore.get(`${identifier}:${purpose}`)
  if (!entry) return false
  if (Date.now() > entry.expiresAt) {
    memoryOtpStore.delete(`${identifier}:${purpose}`)
    return false
  }
  const candidate = hashOtp(identifier, purpose, code.trim())
  // P2-11：常數時間比較（記憶體備援版）
  if (!constantTimeEqual(candidate, entry.codeHash)) return false
  memoryOtpStore.delete(`${identifier}:${purpose}`) // 一次性使用
  return true
}

// ====================================================================
// 短期授權 token（OTP 驗證流程用）
// --------------------------------------------------------------------
// 安全：每張 token 都帶有明確的 purpose（用途），驗證時必須指定預期用途，
// 不同流程的 token 無法互相冒用。例如：
//   - login 發的 LOGIN_OTP_PENDING token 不能拿來重設密碼
//   - OTP 驗證「前」的 *_OTP_PENDING token 不能用來執行需要 OTP 通過的操作
//   - PASSWORD_RESET_VERIFIED 帶有 jti（一次性），搭配 DB grant 防止重放
// ====================================================================
export type TempTokenPurpose =
  | 'LOGIN_OTP_PENDING'
  | 'PASSWORD_RESET_OTP_PENDING'
  | 'PASSWORD_RESET_VERIFIED'
  | 'STUDENT_LOGIN_OTP_PENDING'

export type VerifiedTempToken = {
  userId: string
  purpose: TempTokenPurpose
  /** JWT ID：PASSWORD_RESET_VERIFIED 帶有 jti，用於 DB grant 一次性消耗 */
  jti?: string
  /** 密碼重設 grant 簽發時的 tokenVersion（防重放用） */
  tokenVersion?: number
}

// 產生短期授權 token。必須指定 purpose；PASSWORD_RESET_VERIFIED 額外帶 jti
export async function createTempToken(
  userId: string,
  purpose: TempTokenPurpose,
  extra?: { jti?: string; tokenVersion?: number }
): Promise<string> {
  const payload: Record<string, unknown> = { userId, purpose }
  if (extra?.jti) payload.jti = extra.jti
  if (extra?.tokenVersion !== undefined) payload.tokenVersion = extra.tokenVersion
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(KEY)
}

// 驗證並取出完整 payload。必須指定 expectedPurpose，purpose 不符則回傳 null。
// 回傳 null 的情況：簽章無效 / 已過期 / 缺 userId / purpose 不符。
export async function verifyTempToken(
  token: string,
  expectedPurpose: TempTokenPurpose
): Promise<VerifiedTempToken | null> {
  try {
    const { payload } = await jwtVerify(token, KEY, { algorithms: ['HS256'] })
    const p = payload as { userId?: string; purpose?: string; jti?: string; tokenVersion?: number }
    if (!p.userId) return null
    if (p.purpose !== expectedPurpose) return null
    return {
      userId: p.userId,
      purpose: p.purpose as TempTokenPurpose,
      jti: p.jti,
      tokenVersion: p.tokenVersion,
    }
  } catch {
    return null
  }
}

// ====================================================================
// 誘餌 tempToken（帳號枚舉防護，P1-4）
// --------------------------------------------------------------------
// 忘記密碼 / 自主學生登入等流程在「帳號不存在」時，若回傳空字串 tempToken，
// 攻擊者可從 Network payload 的 tempToken 是否為空判斷帳號存在性。
// 誘餌 token 以隨機 userId 簽發，格式（簽章、purpose、expiry）與真實 token
// 完全一致，攻擊者無法從 payload 區分。下一步 OTP 驗證時，因 OTP 從未為此
// 隨機 userId 產生，比對必然失敗，只會回傳通用錯誤（「驗證碼錯誤或已過期」），
// 不會建立任何 DB 記錄、也不會洩漏帳號存在性。
// 每次 request 使用獨立 randomUUID，使 rate-limit bucket 與真實帳號行為一致。
// ====================================================================
export async function createDummyTempToken(purpose: TempTokenPurpose): Promise<string> {
  return createTempToken(randomUUID(), purpose)
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
