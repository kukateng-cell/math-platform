import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

// session payload
export type SessionPayload = {
  userId: string
  email: string
  role: 'PARENT' | 'ADMIN'
  // tokenVersion：對應 User.tokenVersion，用於角色變更後即時失效舊 session
  tokenVersion?: number
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
// payload 需包含 tokenVersion（來自 User.tokenVersion），用於角色變更後即時失效。
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

// 驗證型 session：查 DB 確認 role 與 tokenVersion 仍有效。
// 用於 admin 等敏感操作——純 JWT 的 getSession() 只適合低風險的快速驗證，
// 因為降級/刪除帳號後舊 JWT 在過期前仍然有效（最多 7 天）。
// getVerifiedSession() 會比對 DB 的最新 role 和 tokenVersion，
// 只要兩者任一不符就回傳 null（視為未登入）。
export async function getVerifiedSession(): Promise<SessionPayload | null> {
  const session = await getSession()
  if (!session) return null

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, role: true, tokenVersion: true },
  })
  if (!user) return null

  // tokenVersion 不符 → 代表 session 已被撤銷（例如角色變更）
  if (session.tokenVersion !== user.tokenVersion) return null

  // 回傳 DB 的最新 role（防止 JWT 內舊 role 被用於越權）
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  }
}

// 撤銷某使用者的所有 session（遞增 tokenVersion）。
// 用於角色變更（升級/降級 admin）、重設密碼等需要即時失效舊 session 的場景。
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
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
