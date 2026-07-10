import { SignJWT, jwtVerify } from 'jose'
import { createHmac } from 'crypto'
import { getSessionKey } from '@/lib/secret'

const KEY = getSessionKey()
const MAX_ATTEMPTS = 3

// CAPTCHA 答案雜湊（HMAC-SHA256 前 12 位 hex，不存明文 answer 到 JWT）
function hashAnswer(answer: number): string {
  return createHmac('sha256', KEY).update(String(answer)).digest('hex').slice(0, 12)
}

// 記憶體追蹤 CAPTCHA 嘗試次數（key: token, value: 嘗試次數）
// JWT 本身有 5 分鐘時效，因此不需額外清理；timeout 到 JWT 過期後自然無效。
const captchaAttempts = new Map<string, number>()

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
  const attempts = captchaAttempts.get(token) ?? 0
  if (attempts >= MAX_ATTEMPTS) {
    return false
  }
  captchaAttempts.set(token, attempts + 1)

  try {
    const { payload } = await jwtVerify(token, KEY, { algorithms: ['HS256'] })
    const data = payload as unknown as { answerHash: string }
    return data.answerHash === hashAnswer(Number(userAnswer.trim()))
  } catch {
    return false
  }
}
