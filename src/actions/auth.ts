'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createSession, deleteSession, getSession } from '@/lib/session'
import { createCaptcha, verifyCaptcha } from '@/lib/captcha'
import { generateOtp, verifyOtp, createTempToken, verifyTempToken, canResendOtp, getResendCooldownSeconds } from '@/lib/otp'
import { sendOtpEmail } from '@/lib/email'
import { SignupFormSchema, LoginFormSchema, ChildProfileSchema, type FormState } from '@/lib/definitions'
import { revalidatePath } from 'next/cache'

// 簡易登入限速：同一 email 在 60 秒內最多 5 次嘗試
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(key: string, max = 5, windowMs = 60_000) {
  const now = Date.now()
  const entry = loginAttempts.get(key)
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  entry.count++
  return entry.count <= max
}

// ============ 註冊（含 CAPTCHA）============
export async function signup(state: FormState, formData: FormData): Promise<FormState> {
  const validated = SignupFormSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors, captcha: await createCaptcha() }
  }
  const { name, email, password } = validated.data

  // CAPTCHA 驗證
  const captchaToken = String(formData.get('captchaToken') || '')
  const captchaAnswer = String(formData.get('captchaAnswer') || '')
  if (!(await verifyCaptcha(captchaToken, captchaAnswer))) {
    return { message: '驗證碼錯誤，請重新作答', captcha: await createCaptcha() }
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return { errors: { email: ['這個 Email 已經註冊過了'] }, captcha: await createCaptcha() }
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: 'PARENT' },
  })

  await createSession({ userId: user.id, email: user.email, role: 'PARENT' })
  redirect('/dashboard')
}

// ============ 登入 Step 1：驗證帳密 + CAPTCHA → 發送 OTP ============
export async function login(state: FormState, formData: FormData): Promise<FormState> {
  const validated = LoginFormSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors, captcha: await createCaptcha() }
  }
  const { email, password } = validated.data

  // CAPTCHA 驗證
  const captchaToken = String(formData.get('captchaToken') || '')
  const captchaAnswer = String(formData.get('captchaAnswer') || '')
  if (!(await verifyCaptcha(captchaToken, captchaAnswer))) {
    return { message: '驗證碼錯誤，請重新作答', captcha: await createCaptcha() }
  }

  if (!checkRateLimit(email)) {
    return { message: '嘗試次數過多，請稍後再試', captcha: await createCaptcha() }
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { message: 'Email 或密碼不正確', captcha: await createCaptcha() }
  }

  // 產生 OTP 驗證碼
  const otpCode = generateOtp(user.id)

  // 發送郵件（非同步，不阻斷流程）
  sendOtpEmail(user.email, otpCode)
  // 開發階段也直接顯示在前端
  const devOtp = process.env.NODE_ENV === 'development' ? otpCode : undefined

  const tempToken = await createTempToken(user.id)

  return {
    otpRequired: true,
    tempToken,
    devOtp,
    message: `驗證碼已發送至 ${email.replace(/(.{3}).+@/, '$1***@')}`,
  }
}

// ============ 登入 Step 2：驗證 OTP → 建立 Session ============
export async function verifyLoginOtp(state: FormState, formData: FormData): Promise<FormState> {
  const tempToken = String(formData.get('tempToken') || '')
  const otpCode = String(formData.get('otpCode') || '')

  if (!tempToken || !otpCode) {
    return { message: '缺少必要參數' }
  }

  const userId = await verifyTempToken(tempToken)
  if (!userId) {
    return { message: '驗證已過期，請重新登入' }
  }

  if (!verifyOtp(userId, otpCode)) {
    return { message: '驗證碼錯誤或已過期' }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return { message: '使用者不存在' }

  await createSession({ userId: user.id, email: user.email, role: user.role })
  redirect(user.role === 'ADMIN' ? '/admin' : '/dashboard')
}

// ============ 重新發送 OTP ============
export async function resendOtp(state: FormState, formData: FormData): Promise<FormState> {
  const tempToken = String(formData.get('tempToken') || '')

  if (!tempToken) {
    return { message: '階段已過期，請重新登入' }
  }

  const userId = await verifyTempToken(tempToken)
  if (!userId) {
    return { message: '階段已過期，請重新登入' }
  }

  // 檢查冷卻時間
  if (!canResendOtp(userId)) {
    const cooldown = getResendCooldownSeconds(userId)
    return { message: `請 ${cooldown} 秒後再重新發送` }
  }

  // 產生新 OTP
  const otpCode = generateOtp(userId)

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user) sendOtpEmail(user.email, otpCode)

  const emailMasked = user
    ? user.email.replace(/(.{3}).+@/, '$1***@')
    : '您的信箱'

  // 開發階段直接顯示驗證碼
  const devOtp = process.env.NODE_ENV === 'development' ? otpCode : undefined

  return {
    otpRequired: true,
    tempToken,
    devOtp,
    message: `新驗證碼已發送至 ${emailMasked}`,
  }
}

// ============ 登出 ============
export async function logout() {
  await deleteSession()
  redirect('/login')
}

// ============ 孩子檔案 CRUD ============
export async function createChild(state: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession()
  if (!session) return { message: '請先登入' }

  const validated = ChildProfileSchema.safeParse({
    nickname: formData.get('nickname'),
    gradeLevel: formData.get('gradeLevel'),
  })
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  await prisma.childProfile.create({
    data: {
      ...validated.data,
      parentId: session.userId,
    },
  })
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function deleteChild(formData: FormData) {
  const session = await getSession()
  if (!session) throw new Error('未授權')

  const childId = String(formData.get('childId'))
  // 確認是這名家長的孩子，避免越權刪除
  await prisma.childProfile.deleteMany({
    where: { id: childId, parentId: session.userId },
  })
  revalidatePath('/dashboard')
}

export async function getCurrentUser() {
  const session = await getSession()
  if (!session) return null
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true },
  })
}
