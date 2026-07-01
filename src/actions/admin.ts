'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

// 管理員授權檢查（每個 action 都要先驗）
async function requireAdmin() {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    throw new Error('需要管理員權限')
  }
  return session
}

export type AdminFormState =
  | { errors?: Record<string, string[]>; message?: string; ok?: boolean }
  | undefined

// ============ 技能 CRUD ============
export async function createSkill(state: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin()
  const code = String(formData.get('code') || '').trim()
  const name = String(formData.get('name') || '').trim()
  const description = String(formData.get('description') || '').trim() || null
  const gradeLevel = String(formData.get('gradeLevel') || 'G1')
  const prerequisiteId = String(formData.get('prerequisiteId') || '') || null

  if (!code || !name) {
    return { errors: { code: code ? [] : ['請填入代碼'], name: name ? [] : ['請填入名稱'] } }
  }

  try {
    await prisma.skill.create({
      data: { code, name, description, gradeLevel, prerequisiteId },
    })
  } catch (e) {
    return { message: '建立失敗（代碼可能重複）' }
  }
  revalidatePath('/admin')
  return { ok: true }
}

export async function toggleSkill(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id'))
  const skill = await prisma.skill.findUnique({ where: { id } })
  if (skill) {
    await prisma.skill.update({ where: { id }, data: { isActive: !skill.isActive } })
  }
  revalidatePath('/admin')
}

// ============ 題目 CRUD ============
export async function createQuestion(state: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin()
  const skillId = String(formData.get('skillId') || '')
  const type = String(formData.get('type') || 'DIRECT') as 'DIRECT' | 'ADD' | 'SUB'
  const prompt = String(formData.get('prompt') || '').trim()
  const answer = String(formData.get('answer') || '').trim()
  const options = String(formData.get('options') || '').trim() || null
  const explanation = String(formData.get('explanation') || '').trim() || null
  const paramsJson = String(formData.get('paramsJson') || '').trim() || null

  if (!skillId || !prompt || !answer) {
    return { message: '技能、題目、答案為必填' }
  }

  await prisma.questionTemplate.create({
    data: { skillId, type, prompt, answer, options, explanation, paramsJson },
  })
  revalidatePath('/admin')
  return { ok: true }
}

export async function toggleQuestion(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id'))
  const q = await prisma.questionTemplate.findUnique({ where: { id } })
  if (q) {
    await prisma.questionTemplate.update({ where: { id }, data: { isActive: !q.isActive } })
  }
  revalidatePath('/admin')
}

// ============ 資料查詢 ============
export async function getAdminStats() {
  await requireAdmin()
  const [skills, questions, attempts, children] = await Promise.all([
    prisma.skill.count(),
    prisma.questionTemplate.count({ where: { isActive: true } }),
    prisma.attempt.count(),
    prisma.childProfile.count(),
  ])
  return { skills, questions, attempts, children }
}

export async function getRecentAttempts(limit = 50) {
  await requireAdmin()
  return prisma.attempt.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      session: { include: { child: true, skill: true } },
    },
  })
}
