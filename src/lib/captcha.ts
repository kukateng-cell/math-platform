import { SignJWT, jwtVerify } from 'jose'
import { createHmac } from 'crypto'
import { getSessionKey } from '@/lib/secret'

const KEY = getSessionKey()

// CAPTCHA 答案雜湊金鑰（與 JWT 簽名金鑰共用，避免獨立管理）
function hashAnswer(answer: number): string {
  return createHmac('sha256', KEY).update(String(answer)).digest('hex').slice(0, 12)
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

  const question = op === '+'
    ? `${a} + ${b} = ?`
    : `${a >= b ? a : b} - ${a >= b ? b : a} = ?`

  return { question, token }
}

// 驗證 CAPTCHA 答案：重新計算 hash 後比對
export async function verifyCaptcha(
  token: string | undefined,
  userAnswer: string | undefined
): Promise<boolean> {
  if (!token || !userAnswer) return false
  try {
    const { payload } = await jwtVerify(token, KEY, { algorithms: ['HS256'] })
    const data = payload as unknown as { answerHash: string }
    return data.answerHash === hashAnswer(Number(userAnswer.trim()))
  } catch {
    return false
  }
}
