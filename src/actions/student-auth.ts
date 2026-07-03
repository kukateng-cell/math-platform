'use server'

import { redirect } from 'next/navigation'
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
  devOtp?: string
  message?: string
} | undefined

type StudentState = { error?: string; ok?: boolean } | undefined

// ============ 自學模式註冊 Step 1：Email + CAPTCHA → 發送 OTP ============
export async function selfStudySignup(state: SelfStudyState, formData: FormData): Promise<SelfStudyState> {
  const { createCaptcha, verifyCaptcha } = await import('@/lib/captcha')
  const { generateOtp, createTempToken } = await import('@/lib/otp')

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

  // 先建立帳號（尚未啟用 session，等 OTP 驗證後才登入）
  const child = await prisma.childProfile.create({
    data: { email, nickname, gradeLevel, mode: 'SELF_STUDY' },
  })

  // 發送 OTP
  const otpCode = generateOtp(child.id)
  sendOtpEmail(email, otpCode)
  const showOtp = process.env.NODE_ENV === 'development' || process.env.SHOW_OTP_IN_UI === 'true'
  const devOtp = showOtp ? otpCode : undefined
  const tempToken = await createTempToken(child.id)

  return {
    otpRequired: true,
    tempToken,
    devOtp,
    message: `驗證碼已發送至 ${email.replace(/(.{3}).+@/, '$1***@')}`,
  }
}

// ============ 自學模式驗證 OTP → 登入 ============
export async function selfStudyVerifyOtp(state: SelfStudyState, formData: FormData): Promise<SelfStudyState> {
  const { verifyOtp, verifyTempToken } = await import('@/lib/otp')

  const tempToken = String(formData.get('tempToken') || '')
  const otpCode = String(formData.get('otpCode') || '')

  if (!tempToken || !otpCode) return { error: '缺少必要參數' }

  const childId = await verifyTempToken(tempToken)
  if (!childId) return { error: '驗證已過期，請重新操作' }

  if (!verifyOtp(childId, otpCode)) return { error: '驗證碼錯誤或已過期' }

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

  const otpCode = generateOtp(child.id)
  sendOtpEmail(child.email, otpCode)
  const showOtp = process.env.NODE_ENV === 'development' || process.env.SHOW_OTP_IN_UI === 'true'
  const devOtp = showOtp ? otpCode : undefined
  const tempToken = await createTempToken(child.id)

  return {
    otpRequired: true,
    tempToken,
    devOtp,
    message: `驗證碼已發送至 ${email.replace(/(.{3}).+@/, '$1***@')}`,
  }
}

// ============ 學生綁定家長 ============
export async function linkParent(state: StudentState, formData: FormData): Promise<StudentState> {
  const { getChildSession: getChild } = await import('@/lib/child-session')
  const childSession = await getChild()
  if (!childSession) return { error: '請先登入' }

  const parentEmail = String(formData.get('parentEmail') || '').trim()
  if (!parentEmail) return { error: '請輸入家長的 Email' }

  const parent = await prisma.user.findUnique({ where: { email: parentEmail } })
  if (!parent || parent.role !== 'PARENT') {
    return { error: '找不到此 Email 對應的家長帳號' }
  }

  // 檢查是否已綁定
  const existing = await prisma.parentChild.findFirst({
    where: { parentId: parent.id, childId: childSession.childId },
  })
  if (existing) {
    return { error: '已經綁定過這位家長了' }
  }

  await prisma.parentChild.create({
    data: { parentId: parent.id, childId: childSession.childId },
  })

  return { ok: true }
}

// ============ 家長查詢已綁定的學生 ============
export async function getLinkedChildren() {
  const session = await getSession()
  if (!session) return null

  const links = await prisma.parentChild.findMany({
    where: { parentId: session.userId },
    include: { child: true },
  })

  return links.map((l) => ({
    id: l.child.id,
    nickname: l.child.nickname,
    gradeLevel: l.child.gradeLevel,
    email: l.child.email,
  }))
}
