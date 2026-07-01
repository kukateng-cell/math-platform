'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createChildSession } from '@/lib/child-session'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ============ 驗證 ============
const StudentSignupSchema = z.object({
  email: z.string().email('請輸入有效的 Email').trim(),
  password: z.string().min(4, '密碼至少 4 個字元').trim(),
  nickname: z.string().min(1, '請輸入暱稱').max(20).trim(),
  gradeLevel: z.enum(['K', 'G1', 'G2']),
  pin: z.string().length(4, 'PIN 碼需為 4 位數字').regex(/^\d{4}$/, 'PIN 碼需為 4 位數字'),
})

const StudentLinkParentSchema = z.object({
  parentEmail: z.string().email('請輸入有效的 Email').trim(),
})

type StudentState = { error?: string; ok?: boolean } | undefined

// ============ 學生自主註冊 ============
export async function studentSignup(state: StudentState, formData: FormData): Promise<StudentState> {
  const pin = composePin(formData)
  if (pin.length !== 4) return { error: '請輸入完整的 4 位數 PIN 碼' }

  const validated = StudentSignupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    nickname: formData.get('nickname'),
    gradeLevel: formData.get('gradeLevel'),
    pin, // pass composed pin for validation
  })
  if (!validated.success) {
    const errors = validated.error.flatten().fieldErrors
    const firstError = Object.values(errors).flat()[0] || '資料格式錯誤'
    return { error: firstError }
  }

  const { email, password, nickname, gradeLevel } = validated.data

  // 檢查 Email 是否已被學生使用
  const existing = await prisma.childProfile.findUnique({ where: { email } })
  if (existing) return { error: '這個 Email 已經註冊過了' }

  // 檢查 PIN 是否已被使用
  const pinUsed = await prisma.childProfile.findFirst({ where: { pin } })
  if (pinUsed) return { error: '此 PIN 碼已被使用，請換一組' }

  const passwordHash = await bcrypt.hash(password, 10)
  const child = await prisma.childProfile.create({
    data: { email, passwordHash, nickname, gradeLevel, pin },
  })

  await createChildSession({ childId: child.id, parentId: '', nickname })
  redirect(`/practice/${child.id}`)
}

// ============ 學生登入（帳密 + PIN，免 CAPTCHA/OTP）============
export async function studentLogin(state: StudentState, formData: FormData): Promise<StudentState> {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')
  const pin = composePin(formData)

  if (!email || !password || pin.length !== 4) {
    return { error: '請填寫完整的登入資訊' }
  }

  const child = await prisma.childProfile.findUnique({ where: { email } })
  if (!child || !child.passwordHash) {
    return { error: 'Email 或密碼不正確' }
  }

  if (!(await bcrypt.compare(password, child.passwordHash))) {
    return { error: 'Email 或密碼不正確' }
  }

  if (child.pin !== pin) {
    return { error: 'PIN 碼錯誤' }
  }

  await createChildSession({
    childId: child.id,
    parentId: child.parentId || '',
    nickname: child.nickname,
  })

  redirect(`/practice/${child.id}`)
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

// ============ 家長幫小孩註冊（建立有帳密的學生）============
export async function parentRegisterStudent(state: StudentState, formData: FormData): Promise<StudentState> {
  const session = await getSession()
  if (!session) return { error: '請先登入' }

  const pin = composePin(formData)
  if (pin.length !== 4) return { error: '請輸入完整的 4 位數 PIN 碼' }

  const validated = StudentSignupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    nickname: formData.get('nickname'),
    gradeLevel: formData.get('gradeLevel'),
    pin,
  })
  if (!validated.success) {
    const errors = validated.error.flatten().fieldErrors
    const firstError = Object.values(errors).flat()[0] || '資料格式錯誤'
    return { error: firstError }
  }

  const { email, password, nickname, gradeLevel } = validated.data

  const existing = await prisma.childProfile.findUnique({ where: { email } })
  if (existing) return { error: '此 Email 已被註冊' }

  const pinUsed = await prisma.childProfile.findFirst({ where: { pin } })
  if (pinUsed) return { error: '此 PIN 碼已被使用' }

  const passwordHash = await bcrypt.hash(password, 10)

  await prisma.childProfile.create({
    data: { email, passwordHash, nickname, gradeLevel, pin, parentId: session.userId },
  })

  revalidatePath('/dashboard')
  return { ok: true }
}

// 從表單 4 格輸入組合 PIN
function composePin(formData: FormData): string {
  return [0, 1, 2, 3].map((i) => String(formData.get(`d${i}`) || '')).join('')
}

// ============ 自學模式驗證 ============
const SelfStudySchema = z.object({
  email: z.string().email('請輸入有效的 Email').trim(),
  password: z.string().min(4, '密碼至少 4 個字元').trim(),
  nickname: z.string().min(1, '請輸入暱稱').max(20).trim(),
  gradeLevel: z.enum(['K', 'G1', 'G2']),
})

type SelfStudyState = {
  error?: string
  otpRequired?: boolean
  tempToken?: string
  captcha?: { question: string; token: string }
  devOtp?: string
  message?: string
} | undefined

// ============ 自學模式 Step 1：註冊 + CAPTCHA → 發送 OTP ============
export async function selfStudySignup(state: SelfStudyState, formData: FormData): Promise<SelfStudyState> {
  const { createCaptcha, verifyCaptcha } = await import('@/lib/captcha')
  const { generateOtp, createTempToken } = await import('@/lib/otp')

  const validated = SelfStudySchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
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

  const { email, password, nickname, gradeLevel } = validated.data

  // 檢查 Email 是否已被使用
  const existing = await prisma.childProfile.findUnique({ where: { email } })
  if (existing) return { error: '此 Email 已被註冊', captcha: await createCaptcha() }

  // 先建立帳號（尚未啟用 session，等 OTP 驗證後才登入）
  const passwordHash = await bcrypt.hash(password, 10)
  const child = await prisma.childProfile.create({
    data: { email, passwordHash, nickname, gradeLevel, mode: 'SELF_STUDY' },
  })

  // 發送 OTP
  const otpCode = generateOtp(child.id)
  const devOtp = process.env.NODE_ENV === 'development' ? otpCode : undefined
  const tempToken = await createTempToken(child.id)

  return {
    otpRequired: true,
    tempToken,
    devOtp,
    message: `驗證碼已發送至 ${email.replace(/(.{3}).+@/, '$1***@')}`,
  }
}

// ============ 自學模式 Step 2：驗證 OTP → 登入 ============
export async function selfStudyVerifyOtp(state: SelfStudyState, formData: FormData): Promise<SelfStudyState> {
  const { verifyOtp, verifyTempToken } = await import('@/lib/otp')

  const tempToken = String(formData.get('tempToken') || '')
  const otpCode = String(formData.get('otpCode') || '')

  if (!tempToken || !otpCode) return { error: '缺少必要參數' }

  const childId = await verifyTempToken(tempToken)
  if (!childId) return { error: '驗證已過期，請重新註冊' }

  if (!verifyOtp(childId, otpCode)) return { error: '驗證碼錯誤或已過期' }

  const child = await prisma.childProfile.findUnique({ where: { id: childId } })
  if (!child) return { error: '帳號不存在' }

  await createChildSession({ childId: child.id, parentId: '', nickname: child.nickname })
  redirect(`/practice/${child.id}`)
}

// ============ 自學模式登入 Step 1：帳密 + CAPTCHA → OTP ============
export async function selfStudyLogin(state: SelfStudyState, formData: FormData): Promise<SelfStudyState> {
  const { createCaptcha, verifyCaptcha } = await import('@/lib/captcha')
  const { generateOtp, createTempToken } = await import('@/lib/otp')

  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')

  if (!email || !password) return { error: '請填寫 Email 和密碼', captcha: await createCaptcha() }

  // CAPTCHA
  const captchaToken = String(formData.get('captchaToken') || '')
  const captchaAnswer = String(formData.get('captchaAnswer') || '')
  if (!(await verifyCaptcha(captchaToken, captchaAnswer))) {
    return { error: '驗證碼錯誤', captcha: await createCaptcha() }
  }

  const child = await prisma.childProfile.findUnique({ where: { email } })
  if (!child || !child.passwordHash || child.mode !== 'SELF_STUDY') {
    return { error: 'Email 或密碼不正確', captcha: await createCaptcha() }
  }

  if (!(await bcrypt.compare(password, child.passwordHash))) {
    return { error: 'Email 或密碼不正確', captcha: await createCaptcha() }
  }

  const otpCode = generateOtp(child.id)
  const devOtp = process.env.NODE_ENV === 'development' ? otpCode : undefined
  const tempToken = await createTempToken(child.id)

  return {
    otpRequired: true,
    tempToken,
    devOtp,
    message: `驗證碼已發送至 ${email.replace(/(.{3}).+@/, '$1***@')}`,
  }
}

// 自學模式登入 Step 2 直接複用 selfStudyVerifyOtp
