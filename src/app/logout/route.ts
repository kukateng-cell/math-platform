import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * GET /logout — 清除 session cookie 并跳转登录页
 * Route Handler 可以直接操作 cookie，无需 Server Action
 */
export async function GET() {
  ;(await cookies()).delete('math-session')
  redirect('/login')
}
