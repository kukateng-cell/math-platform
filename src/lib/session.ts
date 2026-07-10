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
// P2-7：登入家長時清除孩子 session cookie，避免身份混淆
export async function createSession(payload: SessionPayload) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const token = await encrypt(payload)
  const cookieStore = await cookies()
  // 清除孩子 session cookie（避免同時存在兩個身份）
  cookieStore.delete('math-child')
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })
}

// getVerifiedSession() 為 getSession() 的別名（兩者行為相同）。
// 保留此名稱是為了與既有呼叫端（admin.ts、匯出 route）相容。
// 兩者都會查 DB 比對 role 與 tokenVersion，確保舊 session 在撤銷後立即失效。
export async function getVerifiedSession(): Promise<SessionPayload | null> {
  return getSession()
}

// 取得當前 session（供 server component / server action 驗證用）。
//
// ⚠️ 安全說明（P0-3）：此函式會查 DB 比對 tokenVersion 與 role，
// 確保密碼重設 / 角色變更後，舊 JWT 立即失效。這是所有家長功能
// （Server Actions / Route Handlers / 受保護 Server Components）的
// 預設 session getter，務必使用此函式而非純 JWT 版本。
//
// 若 DB 查詢失敗（連線錯誤等），一律回傳 null（fail-closed），
// 避免 DB 異常時降級成不比對版本而讓舊 session 復活。
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  const session = await decrypt(token)
  if (!session) return null

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, role: true, tokenVersion: true },
    })
    if (!user) return null

    // tokenVersion 不符 → session 已被撤銷（密碼重設 / 角色變更），視為未登入
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
    // DB 查詢失敗（連線異常等）→ fail-closed，不降級成純 JWT
    return null
  }
}

// 純 JWT 驗證（不查 DB）。僅供需要極低延遲且可接受「舊 session 在撤銷後仍短暫有效」
// 的場景使用，例如 proxy 的快速導流。所有寫入 / 敏感操作請改用 getSession()。
export async function getUnverifiedSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  return decrypt(token)
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

export const SESSION_COOKIE = COOKIE_NAME
