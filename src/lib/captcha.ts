import { SignJWT, jwtVerify } from 'jose'
import { createHmac } from 'crypto'
import { getSessionKey } from '@/lib/secret'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

const KEY = getSessionKey()
const MAX_ATTEMPTS = 3

// ====================================================================
// CAPTCHA Provider 抽象層（P1-5）
// --------------------------------------------------------------------
// 正式環境支援 Cloudflare Turnstile（需設定 TURNSTILE_SITE_KEY /
// TURNSTILE_SECRET_KEY）；開發環境使用簡單算術 CAPTCHA 做 fallback。
//
// 嘗試次數改用 DB RateLimit 表，不再存在 process memory：
//   - serverless 多 instance 共享
//   - cold start 後不遺失
//   - 有 expiry 自動清理
// ====================================================================

/** 檢查是否啟用 Turnstile（正式環境建議使用） */
function isTurnstileEnabled(): boolean {
  return !!(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY)
}

// ───────── Turnstile 驗證 ─────────
async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY!
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: secretKey, response: token }),
  })
  const data = (await res.json()) as { success: boolean }
  return data.success
}

// ───────── 算術 CAPTCHA ─────────
function hashAnswer(answer: number): string {
  return createHmac('sha256', KEY).update(String(answer)).digest('hex').slice(0, 12)
}

async function createArithmeticChallenge(): Promise<{ question: string; token: string }> {
  const a = Math.floor(Math.random() * 9) + 1
  const b = Math.floor(Math.random() * 9) + 1
  const op: '+' | '-' = Math.random() > 0.5 ? '+' : '-'
  let answer: number
  if (op === '+') {
    answer = a + b
  } else {
    const [big, small] = a >= b ? [a, b] : [b, a]
    answer = big - small
  }

  const answerHash = hashAnswer(answer)
  const token = await new SignJWT({ answerHash })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(KEY)

  const question = op === '+'
    ? `${a} + ${b} = ?`
    : `${a >= b ? a : b} - ${a >= b ? b : a} = ?`

  return { question, token }
}

async function verifyArithmeticToken(token: string, userAnswer: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, KEY, { algorithms: ['HS256'] })
    const data = payload as unknown as { answerHash: string }
    return data.answerHash === hashAnswer(Number(userAnswer.trim()))
  } catch {
    return false
  }
}

// ───────── 取得客戶端 IP（供 rate-limit key 使用）─────────
export async function getClientIp(): Promise<string> {
  try {
    const h = await headers()
    return h.get('x-forwarded-for')?.split(',')[0]?.trim()
      || h.get('x-real-ip')?.trim()
      || 'unknown'
  } catch {
    return 'unknown'
  }
}

/** 限速 key 輔助：結合場景 + identifier + IP */
export function rateLimitKey(scenario: string, identifier: string, ip: string): string {
  return `${scenario}:${identifier}:${ip}`
}

// ───────── 公開 API ─────────

/** 產生 CAPTCHA 挑戰 */
export async function createCaptcha(): Promise<{ question: string; token: string }> {
  if (isTurnstileEnabled()) {
    // Turnstile 由 Cloudflare 前端 widget 產生 token，後端產生 site key
    return { question: '__turnstile__', token: process.env.TURNSTILE_SITE_KEY! }
  }
  return createArithmeticChallenge()
}

/** 驗證 CAPTCHA 答案（含 DB rate-limit 嘗試次數控制） */
export async function verifyCaptcha(
  token: string | undefined,
  userAnswer: string | undefined,
  options?: { identifier?: string; ip?: string }
): Promise<boolean> {
  if (!token || !userAnswer) return false

  if (isTurnstileEnabled()) {
    // Turnstile 驗證（由 Cloudflare 處理，無需 attempt 限制）
    return verifyTurnstileToken(token)
  }

  // 算術 CAPTCHA：使用 DB rate-limit 防暴力破解
  const identifier = options?.identifier || 'captcha'
  const ip = options?.ip || 'unknown'
  const rlKey = rateLimitKey('captcha', identifier, ip)

  // 同 identifier 最�� 3 次嘗試（5 分鐘窗口）
  const { allowed } = await (await import('@/lib/rate-limit')).consumeRateLimit(rlKey, MAX_ATTEMPTS, 300_000)
  if (!allowed) return false

  return verifyArithmeticToken(token, userAnswer)
}

// ============ 向後相容：無 identifier/IP 的舊版 verifyCaptcha ============
// 供尚未傳入 options 的既有呼叫端使用。新程式碼請傳入 identifier/IP。
// 使用場景前綴 + IP 作為 rate-limit key，避免不同操作共用計數。

// ============ 清理過期 CAPTCHA 嘗試記錄（DB + 記憶體）============
// CAPTCHA 嘗試次數已移到 DB RateLimit 表，由 cleanupExpiredRateLimits 清理。
// 此函式保留為向後相容，回傳 0（無需額外清理）。
export function cleanupExpiredCaptchas(): number {
  return 0
}
