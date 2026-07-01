import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

// session payload
export type SessionPayload = {
  userId: string
  email: string
  role: 'PARENT' | 'ADMIN'
}

const COOKIE_NAME = 'math-session'
const secretKey = process.env.SESSION_SECRET
if (!secretKey) {
  throw new Error('SESSION_SECRET is not set. Add it to .env (use: openssl rand -base64 32)')
}
const encodedKey = new TextEncoder().encode(secretKey)

// 加密產生 JWT
export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey)
}

// 解密驗證 JWT
export async function decrypt(token: string | undefined = ''): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ['HS256'],
    })
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

// 建立 session cookie（登入/註冊成功時呼叫）
export async function createSession(payload: SessionPayload) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const token = await encrypt(payload)
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })
}

// 刪除 session（登出時呼叫）
export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

// 取得當前 session（供 server component / server action 驗證用）
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  return decrypt(token)
}

export const SESSION_COOKIE = COOKIE_NAME
