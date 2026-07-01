import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// 受保護路徑：家長端、管理端、學生練習
const PROTECTED = ['/dashboard', '/admin', '/practice', '/children', '/result']
// 已登入者不該再看到：登入、註冊
const AUTH_PAGES = ['/login', '/signup']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('math-session')?.value

  let isAuthenticated = false
  if (token) {
    try {
      const key = new TextEncoder().encode(process.env.SESSION_SECRET)
      await jwtVerify(token, key, { algorithms: ['HS256'] })
      isAuthenticated = true
    } catch {
      isAuthenticated = false
    }
  }

  // 受保護頁面但未登入 → 導向登入頁
  if (PROTECTED.some((p) => pathname.startsWith(p)) && !isAuthenticated) {
    const url = new URL('/login', request.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // 已登入還跑到登入/註冊 → 導向 dashboard（管理員到 admin）
  if (AUTH_PAGES.includes(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  // 排除靜態資源與 API
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
