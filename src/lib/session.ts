import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getSessionKey } from '@/lib/secret'

// session payload
export type SessionPayload = {
  userId: string
  email: string
  role: 'PARENT' | 'ADMIN'
  // tokenVersion：對應 User.tokenVersion，用於角色變更後即時失效舊 session
  tokenVersion?: number
}

const COOKIE_NAME = 'math-session'

// 加密產生 JWT
// 簽章金鑰由 getSessionKey()（@/lib/secret）統一管理並帶 fail-fast 檢查，
// 此處不再於模組頂層拋錯，避免 SESSION_SECRET 未設定時整個應用啟動即崩潰，
// 無法提供任何頁面（連登入頁都打不開）。改為呼叫時才檢查，做到優雅降級。
export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSessionKey())
}

// 解密驗證 JWT
export async function decrypt(token: string | undefined = ''): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionKey(), {
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
// 若 tokenVersion 欄位尚不存在（DB 尚未 migration），則只驗證 role。
export async function getVerifiedSession(): Promise<SessionPayload | null> {
  const session = await getSession()
  if (!session) return null

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, role: true, tokenVersion: true },
    })
    if (!user) return null

    // tokenVersion 不比對的兩種情況：
    // 1. 舊 JWT 中沒有 tokenVersion（DB migration 前簽發的 session）
    // 2. DB 已補上 tokenVersion 但 JWT 尚未更新
    // 這兩種情況下只驗證 role，不把舊 session 視為無效
    if (session.tokenVersion !== undefined && session.tokenVersion !== user.tokenVersion) {
      return null
    }

    // 回傳 DB 的最新 role（防止 JWT 內舊 role 被用於越權）
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    }
  } catch {
    // tokenVersion 欄位不存在（DB 尚未 migration）→ 只驗證 role
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, role: true },
    })
    if (!user) return null
    return { userId: user.id, email: user.email, role: user.role }
  }
}

// 撤銷某使用者的所有 session（遞增 tokenVersion）。
// 用於角色變更（升級/降級 admin）、重設密碼等需要即時失效舊 session 的場景。
export async function revokeAllSessions(userId: string): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    })
  } catch {
    // tokenVersion 欄位不存在則跳過
    console.warn('[revokeAllSessions] tokenVersion column not available')
  }
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
