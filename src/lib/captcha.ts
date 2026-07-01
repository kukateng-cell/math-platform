import { SignJWT, jwtVerify } from 'jose'

const SECRET = process.env.SESSION_SECRET || 'fallback-secret'
const KEY = new TextEncoder().encode(SECRET)

type CaptchaPayload = {
  a: number
  b: number
  op: '+' | '-'
  answer: number
}

// 產生 CAPTCHA 挑戰題：回傳 { question, token }，token 為簽名後的答案
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

  const payload: CaptchaPayload = { a, b, op, answer }
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(KEY)

  const question = op === '+'
    ? `${a} + ${b} = ?`
    : `${a >= b ? a : b} - ${a >= b ? b : a} = ?`

  return { question, token }
}

// 驗證 CAPTCHA 答案
export async function verifyCaptcha(
  token: string | undefined,
  userAnswer: string | undefined
): Promise<boolean> {
  if (!token || !userAnswer) return false
  try {
    const { payload } = await jwtVerify(token, KEY, { algorithms: ['HS256'] })
    const data = payload as unknown as CaptchaPayload
    return String(data.answer) === userAnswer.trim()
  } catch {
    return false
  }
}
