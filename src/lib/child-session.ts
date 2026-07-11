import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { getSessionKey } from '@/lib/secret'

const CHILD_COOKIE = 'math-child'
const PARENT_COOKIE = 'math-session'

export type ChildSessionPayload = {
  childId: string
  parentId: string
  nickname: string
}

// 建立孩子練習 session（僅供練習路由使用，無法存取家長端）
// P2-7：登入孩子時清除家長 cookie，避免身份混淆
export async function createChildSession(payload: ChildSessionPayload) {
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h') // 孩子練習 session 2 小時過期
    .sign(getSessionKey())

  const cookieStore = await cookies()
  // 清除家長 session cookie（避免同時存在兩個身份）
  cookieStore.delete(PARENT_COOKIE)
  cookieStore.set(CHILD_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 2 * 60 * 60, // 2 小時
    path: '/',
  })
}

// 取得孩子 session
export async function getChildSession(): Promise<ChildSessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(CHILD_COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSessionKey(), { algorithms: ['HS256'] })
    return payload as unknown as ChildSessionPayload
  } catch {
    return null
  }
}

// 清除孩子 session（登出用）
export async function deleteChildSession() {
  const cookieStore = await cookies()
  cookieStore.delete(CHILD_COOKIE)
}

// P2-7：全登出——同時清除家長與孩子 cookie
export async function deleteAllSessions() {
  const cookieStore = await cookies()
  cookieStore.delete(CHILD_COOKIE)
  cookieStore.delete(PARENT_COOKIE)
}
