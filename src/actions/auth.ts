'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createSession, deleteSession, getSession } from '@/lib/session'
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

// ============ 註冊 ============
export async function signup(state: FormState, formData: FormData): Promise<FormState> {
  const validated = SignupFormSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }
  const { name, email, password } = validated.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return { errors: { email: ['這個 Email 已經註冊過了'] } }
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: 'PARENT' },
  })

  await createSession({ userId: user.id, email: user.email, role: 'PARENT' })
  redirect('/dashboard')
}

// ============ 登入 ============
export async function login(state: FormState, formData: FormData): Promise<FormState> {
  const validated = LoginFormSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }
  const { email, password } = validated.data

  if (!checkRateLimit(email)) {
    return { message: '嘗試次數過多，請稍後再試' }
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { message: 'Email 或密碼不正確' }
  }

  await createSession({ userId: user.id, email: user.email, role: user.role })
  redirect(user.role === 'ADMIN' ? '/admin' : '/dashboard')
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
