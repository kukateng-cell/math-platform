import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { cleanupAuthTempData } from '@/lib/cleanup'

// ====================================================================
// 臨時認證資料清理 — Cron 端點（P2-10）
// --------------------------------------------------------------------
// 清理已過期 / 已消耗的臨時認證資料，避免資料表無限累積：
//   - OtpCode（過期）
//   - PendingSignup（過期）
//   - PasswordResetGrant（已消耗 / 陳舊未使用）
//   - RateLimit（窗口已過）
//   - CAPTCHA 嘗試 Map（記憶體，陳舊 token）
//
// 觸發：
//   1. Vercel Cron（vercel.json）→ 自動帶 Authorization: Bearer $CRON_SECRET
//   2. 外部排程器 / curl → 需自行帶相同 Header
//
// 鑑權：必須設定 CRON_SECRET，且請求的 Bearer token 須與之相符。
//       未設定 CRON_SECRET 時直接 503（避免無鑑權的清理端點被濫用）。
// ====================================================================

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function unauthorized(message: string, status = 401) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

async function handleCleanup() {
  const startedAt = new Date().toISOString()
  const result = await cleanupAuthTempData()
  const finishedAt = new Date().toISOString()

  return NextResponse.json(
    {
      ok: result.errors.length === 0,
      startedAt,
      finishedAt,
      deleted: {
        otp: result.otp,
        pendingSignups: result.pendingSignups,
        passwordResetGrants: result.passwordResetGrants,
        rateLimits: result.rateLimits,
        captchas: result.captchas,
      },
      ...(result.errors.length > 0 ? { errors: result.errors } : {}),
    },
    { status: result.errors.length === 0 ? 200 : 207 }
  )
}

// Vercel Cron 預設以 GET 觸發
export async function GET(request: Request) {
  return authorize(request, handleCleanup)
}

// 支援外部排程器以 POST 觸發
export async function POST(request: Request) {
  return authorize(request, handleCleanup)
}

async function authorize(request: Request, handler: () => Promise<Response>): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // 未設定 CRON_SECRET：拒絕服務，避免無鑑權端點被濫用
    return unauthorized('CRON_SECRET is not configured', 503)
  }

  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  // 常數時間比較，避免 timing 攻擊
  if (token.length !== secret.length || !timingSafeEqualStr(token, secret)) {
    return unauthorized('Invalid or missing Authorization header')
  }

  return handler()
}

/** 常數時間比較兩個等長字串 */
function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  // 呼叫端已先檢查長度相等
  return timingSafeEqual(bufA, bufB)
}
