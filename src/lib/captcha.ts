import { SignJWT, jwtVerify } from 'jose'
import { createHmac } from 'crypto'
import { getSessionKey } from '@/lib/secret'

const KEY = getSessionKey()
const MAX_ATTEMPTS = 3

// CAPTCHA 答案雜湊（HMAC-SHA256 前 12 位 hex，不存明文 answer 到 JWT）
function hashAnswer(answer: number): string {
  return createHmac('sha256', KEY).update(String(answer)).digest('hex').slice(0, 12)
}

// 記憶體追蹤 CAPTCHA 嘗試次數（key: token, value: 嘗試次數 + 建立時間）
// JWT 本身有 5 分鐘時效，token 過期後即無法通過 jwtVerify；
// 但 Map entry 若不清理會無限累積（記憶體洩漏），故記錄 createdAt 供定期清理。
// P2-10：CAPTCHA_RETENTION_MS 取 JWT 壽命（5 分鐘）+ 緩衝，超過即視為陳舊可刪。
const CAPTCHA_RETENTION_MS = 10 * 60 * 1000 // 10 分鐘（JWT 5 分鐘 + 緩衝）
const captchaAttempts = new Map<string, { attempts: number; createdAt: number }>()

// 清理過期（陳舊）的 CAPTCHA 嘗試記錄，回傳清除筆數。
// 由 cleanupAuthTempData()（cron / CLI）定期呼叫；createCaptcha 也會順帶呼叫。
export function cleanupExpiredCaptchas(now = Date.now()): number {
  let removed = 0
  for (const [token, entry] of captchaAttempts) {
    if (now - entry.createdAt > CAPTCHA_RETENTION_MS) {
      captchaAttempts.delete(token)
      removed++
    }
  }
  return removed
}

// 產生 CAPTCHA 挑戰題：回傳 { question, token }，token 為簽名後的答案 hash
// 安全：JWT payload 只存 answerHash，不存明文 answer，避免客戶端 decode 直接讀到答案。
export async function createCaptcha(): Promise<{ question: string; token: string }> {
  const a = Math.floor(Math.random() * 9) + 1   // 1-9
  const b = Math.floor(Math.random() * 9) + 1   // 1-9
  const op: '+' | '-' = Math.random() > 0.5 ? '+' : '-'
  let answer: number
  if (op === '+') {
    answer = a + b
  } else {
    // 確保減法答案非負
    const [big, small] = a >= b ? [a, b] : [b, a]
    answer = big - small
  }

  const answerHash = hashAnswer(answer)
  const token = await new SignJWT({ answerHash })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(KEY)

  // P2-10：順帶清理陳舊的嘗試記錄，限制 Map 無限成長
  cleanupExpiredCaptchas()

  const question = op === '+'
    ? `${a} + ${b} = ?`
    : `${a >= b ? a : b} - ${a >= b ? b : a} = ?`

  return { question, token }
}

// 驗證 CAPTCHA 答案（含嘗試次數限制：同 token 最多 3 次）
export async function verifyCaptcha(
  token: string | undefined,
  userAnswer: string | undefined
): Promise<boolean> {
  if (!token || !userAnswer) return false

  // 檢查嘗試次數
  const entry = captchaAttempts.get(token)
  const attempts = entry?.attempts ?? 0
  if (attempts >= MAX_ATTEMPTS) {
    return false
  }
  captchaAttempts.set(token, { attempts: attempts + 1, createdAt: entry?.createdAt ?? Date.now() })

  try {
    const { payload } = await jwtVerify(token, KEY, { algorithms: ['HS256'] })
    const data = payload as unknown as { answerHash: string }
    return data.answerHash === hashAnswer(Number(userAnswer.trim()))
  } catch {
    return false
  }
}
