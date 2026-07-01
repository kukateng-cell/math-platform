import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET = process.env.SESSION_SECRET || 'fallback-secret'
const KEY = new TextEncoder().encode(SECRET)

const CHILD_COOKIE = 'math-child'

export type ChildSessionPayload = {
  childId: string
  parentId: string
  nickname: string
}

// 建立孩子練習 session（僅供練習路由使用，無法存取家長端）
export async function createChildSession(payload: ChildSessionPayload) {
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h') // 孩子練習 session 2 小時過期
    .sign(KEY)

  const cookieStore = await cookies()
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
    const { payload } = await jwtVerify(token, KEY, { algorithms: ['HS256'] })
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
