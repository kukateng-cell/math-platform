'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createChildSession } from '@/lib/child-session'
import { getSession } from '@/lib/session'
import { z } from 'zod'
import { sendOtpEmail } from '@/lib/email'

// ============ 驗證 ============
// 自主學習註冊：Email + 暱稱 + 年級（免密碼，用驗證碼登入）
const SelfStudySignupSchema = z.object({
  email: z.string().email('請輸入有效的 Email').trim(),
  nickname: z.string().min(1, '請輸入暱稱').max(20).trim(),
  gradeLevel: z.enum(['K', 'G1', 'G2', 'G3', 'G4']),
})

// 自主學習登入：只需 Email（密碼由驗證碼取代）
const SelfStudyLoginSchema = z.object({
  email: z.string().email('請輸入有效的 Email').trim(),
})

type SelfStudyState = {
  error?: string
  otpRequired?: boolean
  tempToken?: string
  captcha?: { question: string; token: string }
  message?: string
} | undefined

type StudentState = { error?: string; ok?: boolean; message?: string } | undefined

// ============ 自學模式註冊 Step 1：Email + CAPTCHA → 發送 OTP ============
// 安全：帳號「不」在此步驟建立。註冊資料簽進 signup token，
//       OTP 驗證通過後才寫入 DB（避免未驗證殭屍帳號 / 佔用別人 email）。
//       OTP 以 email 為金鑰暫存於記憶體。
export async function selfStudySignup(state: SelfStudyState, formData: FormData): Promise<SelfStudyState> {
  const { createCaptcha, verifyCaptcha } = await import('@/lib/captcha')
  const { generateOtp, createSignupToken } = await import('@/lib/otp')

  const validated = SelfStudySignupSchema.safeParse({
    email: formData.get('email'),
    nickname: formData.get('nickname'),
    gradeLevel: formData.get('gradeLevel'),
  })
  if (!validated.success) {
    const e = Object.values(validated.error.flatten().fieldErrors).flat()[0]
    return { error: e || '資料錯誤', captcha: await createCaptcha() }
  }

  // CAPTCHA 驗證
  const captchaToken = String(formData.get('captchaToken') || '')
  const captchaAnswer = String(formData.get('captchaAnswer') || '')
  if (!(await verifyCaptcha(captchaToken, captchaAnswer))) {
    return { error: '驗證碼錯誤', captcha: await createCaptcha() }
  }

  const { email, nickname, gradeLevel } = validated.data

  // 檢查 Email 是否已被使用
  const existing = await prisma.childProfile.findUnique({ where: { email } })
  if (existing) return { error: '此 Email 已被註冊', captcha: await createCaptcha() }

  // 產生 OTP（以 email 為金鑰）並寄出 — 學生端一律不顯示開發模式 OTP
  const otpCode = await generateOtp(email)
  const emailResult = await sendOtpEmail(email, otpCode)
  if (!emailResult.success) {
    console.error('[EMAIL FAILED]', emailResult.error)
    // 寄送失敗：不謊稱「已發送」，讓使用者知道並可重試
    return {
      error: '驗證碼發送失敗，請確認 Email 是否正確或稍後再試',
      captcha: await createCaptcha(),
    }
  }

  // 把註冊資料簽進 token（DB 尚未建立帳號）
  const tempToken = await createSignupToken({ email, nickname, gradeLevel })

  return {
    otpRequired: true,
    tempToken,
    message: `驗證碼已發送至 ${email.replace(/(.{3}).+@/, '$1***@')}`,
  }
}

// ============ 自學模式驗證 OTP → 登入 ============
// 同時處理「註冊」(signup token) 與「登入」(temp token) 兩種來源：
//   - 註冊：token 內含註冊資料 → OTP 通過後才建立帳號
//   - 登入：token 內含 userId → OTP 通過後直接建立 session
export async function selfStudyVerifyOtp(state: SelfStudyState, formData: FormData): Promise<SelfStudyState> {
  const { verifyOtp, verifyTempToken, verifySignupToken } = await import('@/lib/otp')

  const tempToken = String(formData.get('tempToken') || '')
  const otpCode = String(formData.get('otpCode') || '')

  if (!tempToken || !otpCode) return { error: '缺少必要參數' }

  // 先嘗試視為「註冊」token
  const signupIntent = await verifySignupToken(tempToken)
  if (signupIntent) {
    // 註冊路徑：OTP 以 email 為金鑰
    if (!verifyOtp(signupIntent.email, otpCode)) {
      return { tempToken, error: '驗證碼錯誤或已過期' }
    }
    // 再次確認 email 未被佔用（避免競態：發信後、驗證前被人註冊）
    const existing = await prisma.childProfile.findUnique({ where: { email: signupIntent.email } })
    if (existing) return { error: '此 Email 已被註冊' }

    const child = await prisma.childProfile.create({
      data: {
        email: signupIntent.email,
        nickname: signupIntent.nickname,
        gradeLevel: signupIntent.gradeLevel,
        mode: 'SELF_STUDY',
      },
    })
    await createChildSession({ childId: child.id, parentId: '', nickname: child.nickname })
    redirect(`/practice/${child.id}`)
  }

  // 否則視為「登入」temp token
  const childId = await verifyTempToken(tempToken)
  if (!childId) return { error: '驗證已過期，請重新操作' }

  if (!(await verifyOtp(childId, otpCode))) return { error: '驗證碼錯誤或已過期' }

  const child = await prisma.childProfile.findUnique({ where: { id: childId } })
  if (!child) return { error: '帳號不存在' }

  await createChildSession({ childId: child.id, parentId: '', nickname: child.nickname })
  redirect(`/practice/${child.id}`)
}

// ============ 自學模式登入 Step 1：Email + CAPTCHA → OTP（免密碼）============
export async function selfStudyLogin(state: SelfStudyState, formData: FormData): Promise<SelfStudyState> {
  const { createCaptcha, verifyCaptcha } = await import('@/lib/captcha')
  const { generateOtp, createTempToken } = await import('@/lib/otp')

  const validated = SelfStudyLoginSchema.safeParse({
    email: formData.get('email'),
  })
  if (!validated.success) {
    const e = Object.values(validated.error.flatten().fieldErrors).flat()[0]
    return { error: e || '資料錯誤', captcha: await createCaptcha() }
  }

  const { email } = validated.data

  // CAPTCHA
  const captchaToken = String(formData.get('captchaToken') || '')
  const captchaAnswer = String(formData.get('captchaAnswer') || '')
  if (!(await verifyCaptcha(captchaToken, captchaAnswer))) {
    return { error: '驗證碼錯誤', captcha: await createCaptcha() }
  }

  const child = await prisma.childProfile.findUnique({ where: { email } })
  // 帳號不存在 / 非自主學習帳號 → 回傳相同訊息（避免帳號枚舉攻擊）
  if (!child || !child.email || child.mode !== 'SELF_STUDY') {
    return { error: '若此 Email 已註冊，驗證碼已發送至信箱', captcha: await createCaptcha() }
  }

  const otpCode = await generateOtp(child.id)
  const emailResult = await sendOtpEmail(child.email, otpCode)
  if (!emailResult.success) {
    console.error('[EMAIL FAILED]', emailResult.error)
    // 寄送失敗：告知使用者，不謊稱已發送
    return { error: '驗證碼發送失敗，請稍後再試', captcha: await createCaptcha() }
  }
  const tempToken = await createTempToken(child.id)

  return {
    otpRequired: true,
    tempToken,
    message: `驗證碼已發送至 ${email.replace(/(.{3}).+@/, '$1***@')}`,
  }
}

// ============ 自學模式：重新發送 OTP（使用者主動「換一組驗證碼」）============
// 走 OTP 冷卻機制（60 秒內不可重發），產生新 6 位數碼並寄信
// 同時支援「註冊」(signup token，以 email 為 OTP 金鑰) 與「登入」(temp token，以 childId 為金鑰)
export async function selfStudyResendOtp(state: SelfStudyState, formData: FormData): Promise<SelfStudyState> {
  const { verifyTempToken, verifySignupToken, generateOtp, canResendOtp, getResendCooldownSeconds } = await import('@/lib/otp')

  const tempToken = String(formData.get('tempToken') || '')
  if (!tempToken) return { error: '階段已過期，請重新操作' }

  // 先嘗試視為「註冊」token（OTP 以 email 為金鑰）
  const signupIntent = await verifySignupToken(tempToken)
  if (signupIntent) {
    if (!canResendOtp(signupIntent.email)) {
      const cooldown = getResendCooldownSeconds(signupIntent.email)
      return { otpRequired: true, tempToken, message: `請 ${cooldown} 秒後再重新發送` }
    }
    const otpCode = await generateOtp(signupIntent.email)
    const emailResult = await sendOtpEmail(signupIntent.email, otpCode)
    if (!emailResult.success) {
      console.error('[EMAIL FAILED]', emailResult.error)
      return { tempToken, error: '驗證碼發送失敗，請稍後再試' }
    }
    return {
      otpRequired: true,
      tempToken,
      message: `新驗證碼已發送至 ${signupIntent.email.replace(/(.{3}).+@/, '$1***@')}`,
    }
  }

  // 否則視為「登入」temp token（OTP 以 childId 為金鑰）
  const childId = await verifyTempToken(tempToken)
  if (!childId) return { error: '階段已過期，請重新操作' }

  // 冷卻檢查
  if (!(await canResendOtp(childId))) {
    const cooldown = await getResendCooldownSeconds(childId)
    return {
      otpRequired: true,
      tempToken,
      message: `請 ${cooldown} 秒後再重新發送`,
    }
  }

  const child = await prisma.childProfile.findUnique({ where: { id: childId } })
  if (!child || !child.email) return { error: '帳號不存在', tempToken }

  // 產生新 OTP 並透過 Gmail SMTP 寄出 — 學生端一律不顯示開發模式 OTP
  const otpCode = await generateOtp(childId)
  const emailResult = await sendOtpEmail(child.email, otpCode)
  if (!emailResult.success) {
    console.error('[EMAIL FAILED]', emailResult.error)
    return { tempToken, error: '驗證碼發送失敗，請稍後再試' }
  }

  return {
    otpRequired: true,
    tempToken,
    message: `新驗證碼已發送至 ${child.email.replace(/(.{3}).+@/, '$1***@')}`,
  }
}

// ============ 學生綁定家長（須家長確認）============
// 安全：學生只知道家長 email 不足以完成綁定。這裡只建立 PENDING 請求，
//       並通知家長；家長須登入後台「確認」才會變成 ACTIVE（家長才看得到孩子資料）。
export async function linkParent(state: StudentState, formData: FormData): Promise<StudentState> {
  const { getChildSession: getChild } = await import('@/lib/child-session')
  const { sendLinkRequestEmail } = await import('@/lib/email')
  const childSession = await getChild()
  if (!childSession) return { error: '請先登入' }

  const parentEmail = String(formData.get('parentEmail') || '').trim().toLowerCase()
  if (!parentEmail) return { error: '請輸入家長的 Email' }

  const parent = await prisma.user.findUnique({ where: { email: parentEmail } })
  if (!parent || parent.role !== 'PARENT') {
    return { error: '找不到此 Email 對應的家長帳號' }
  }

  // 檢查是否已存在請求 / 綁定（含 PENDING 與 ACTIVE）
  const existing = await prisma.parentChild.findFirst({
    where: { parentId: parent.id, childId: childSession.childId },
  })
  if (existing) {
    return {
      error:
        existing.status === 'ACTIVE'
          ? '已經綁定過這位家長了'
          : '已送出綁定請求，正在等待家長確認',
    }
  }

  await prisma.parentChild.create({
    data: { parentId: parent.id, childId: childSession.childId, status: 'PENDING' },
  })

  // 通知家長（best-effort；失敗僅記 log，不影響請求成立，家長仍可在後台看到）
  const emailResult = await sendLinkRequestEmail(parent.email, childSession.nickname)
  if (!emailResult.success) {
    console.error('[LINK REQUEST EMAIL FAILED]', emailResult.error)
  }

  return { ok: true, message: '綁定請求已送出，請家長登入後台確認' }
}

// ============ 家長查詢「待確認」的綁定請求 ============
export async function getPendingLinkRequests() {
  const session = await getSession()
  if (!session) return []

  const links = await prisma.parentChild.findMany({
    where: { parentId: session.userId, status: 'PENDING' },
    include: { child: true },
    orderBy: { createdAt: 'desc' },
  })

  return links.map((l) => ({
    linkId: l.id,
    childId: l.child.id,
    nickname: l.child.nickname,
    gradeLevel: l.child.gradeLevel,
    email: l.child.email,
    createdAt: l.createdAt,
  }))
}

// ============ 家長：確認綁定請求（PENDING → ACTIVE）============
export async function confirmLink(formData: FormData) {
  const session = await getSession()
  if (!session) throw new Error('請先登入')

  const linkId = String(formData.get('linkId') || '')
  // 確認是這名家長本人的請求，避免越權
  const link = await prisma.parentChild.findFirst({
    where: { id: linkId, parentId: session.userId },
  })
  if (!link) throw new Error('找不到此綁定請求')

  await prisma.parentChild.update({
    where: { id: linkId },
    data: { status: 'ACTIVE' },
  })
  revalidatePath('/dashboard')
}

// ============ 家長：拒絕綁定請求（刪除 PENDING 記錄）============
export async function rejectLink(formData: FormData) {
  const session = await getSession()
  if (!session) throw new Error('請先登入')

  const linkId = String(formData.get('linkId') || '')
  const link = await prisma.parentChild.findFirst({
    where: { id: linkId, parentId: session.userId },
  })
  if (!link) throw new Error('找不到此綁定請求')

  await prisma.parentChild.delete({ where: { id: linkId } })
  revalidatePath('/dashboard')
}

// ============ 家長查詢「已生效」的綁定學生 ============
export async function getLinkedChildren() {
  const session = await getSession()
  if (!session) return null

  const links = await prisma.parentChild.findMany({
    where: { parentId: session.userId, status: 'ACTIVE' },
    include: { child: true },
  })

  return links.map((l) => ({
    id: l.child.id,
    nickname: l.child.nickname,
    gradeLevel: l.child.gradeLevel,
    email: l.child.email,
  }))
}
