import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// 受保護路徑：家長端、管理端
// 注意：/children 同時允許「自主學習的孩子」查看自己的檔案（見下方 CHILD_OWN 規則）
const PROTECTED = ['/dashboard', '/admin', '/children']
// 孩子練習路由（可用孩子 session 或家長 session）
const CHILD_ROUTES = ['/practice']
// 孩子可查看「自己」檔案的路由（自主學習孩子：家長 session 或本人孩子 session）
const CHILD_OWN = ['/children']
// 已登入者不該再看到：登入、註冊
const AUTH_PAGES = ['/login', '/signup']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('math-session')?.value
  const childToken = request.cookies.get('math-child')?.value

  let isAuthenticated = false
  let role: string | undefined

  if (token) {
    try {
      const key = new TextEncoder().encode(process.env.SESSION_SECRET)
      const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] })
      isAuthenticated = true
      role = payload.role as string | undefined
    } catch {
      isAuthenticated = false
    }
  }

  // 檢查孩子 session（僅對練習路由有效）
  let isChildAuthenticated = false
  if (childToken && CHILD_ROUTES.some((p) => pathname.startsWith(p))) {
    try {
      const key = new TextEncoder().encode(process.env.SESSION_SECRET)
      await jwtVerify(childToken, key, { algorithms: ['HS256'] })
      isChildAuthenticated = true
    } catch {
      isChildAuthenticated = false
    }
  }

  // 孩子查看「自己」的檔案：自主學習孩子可用自己的 session 存取 /children/{自己的id}
  let childOwnAllowed = false
  if (childToken && CHILD_OWN.some((p) => pathname.startsWith(p))) {
    try {
      const key = new TextEncoder().encode(process.env.SESSION_SECRET)
      const { payload } = await jwtVerify(childToken, key, { algorithms: ['HS256'] })
      // 路徑中的 childId 必須與 session 中的 childId 一致
      const pathChildId = pathname.split('/')[2]
      childOwnAllowed = payload.childId === pathChildId
    } catch {
      childOwnAllowed = false
    }
  }

  // 孩子練習路由：孩子 session 或家長 session 皆可
  if (CHILD_ROUTES.some((p) => pathname.startsWith(p))) {
    if (isAuthenticated || isChildAuthenticated) {
      return NextResponse.next()
    }
    const url = new URL('/student/login', request.url)
    return NextResponse.redirect(url)
  }

  // 受保護頁面但未登入 → 導向登入頁
  // 例外：孩子查看自己的檔案（/children/{自己id}）已被允許，不在此攔截
  if (PROTECTED.some((p) => pathname.startsWith(p)) && !isAuthenticated && !childOwnAllowed) {
    const url = new URL('/login', request.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // 已登入還跑到登入/註冊 → 按角色導向
  if (AUTH_PAGES.includes(pathname) && isAuthenticated) {
    const target = role === 'ADMIN' ? '/admin' : '/dashboard'
    return NextResponse.redirect(new URL(target, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
