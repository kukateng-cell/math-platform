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
  const type = String(formData.get('type') || 'DIRECT') as 'DIRECT' | 'ADD' | 'SUB' | 'MUL' | 'DIV' | 'WORD_PROBLEM'
  const prompt = String(formData.get('prompt') || '').trim()
  const answer = String(formData.get('answer') || '').trim()
  const options = String(formData.get('options') || '').trim() || null
  const explanation = String(formData.get('explanation') || '').trim() || null
  const paramsJsonRaw = String(formData.get('paramsJson') || '').trim()

  if (!skillId || !prompt || !answer) {
    return { message: '技能、題目、答案為必填' }
  }

  // 參數化題（ADD/SUB/MUL/DIV/WORD_PROBLEM）必須有合法 JSON 參數
  let mergedParamsJson: string | null = paramsJsonRaw || null
  if (type === 'ADD' || type === 'SUB' || type === 'MUL' || type === 'DIV' || type === 'WORD_PROBLEM') {
    if (!paramsJsonRaw) {
      return { message: '參數化題型（ADD/SUB）必須填寫參數 JSON' }
    }
    try {
      const parsed = JSON.parse(paramsJsonRaw)
      if (typeof parsed.aMin !== 'number' || typeof parsed.aMax !== 'number' ||
          typeof parsed.bMin !== 'number' || typeof parsed.bMax !== 'number') {
        return { message: '參數 JSON 需包含 aMin, aMax, bMin, bMax 數字欄位' }
      }
    } catch {
      return { message: '參數 JSON 格式無效，請檢查語法' }
    }
  }

  // ============ 合併互動模式到 paramsJson ============
  // 表單的 interaction（choice/numberline/fillin）與 rangeMin/rangeMax/inputMode
  // 需要寫進 paramsJson，練習端才讀得到。
  // 對於參數化題（已有 paramsJson）→ 合併欄位；對於直接題（無 paramsJson）→ 若非 choice 則建立。
  const interaction = String(formData.get('interaction') || 'choice')
  const rangeMinRaw = String(formData.get('rangeMin') || '').trim()
  const rangeMaxRaw = String(formData.get('rangeMax') || '').trim()
  const inputMode = String(formData.get('inputMode') || 'numeric')
  const extra: Record<string, unknown> = {}
  if (interaction && interaction !== 'choice') extra.interaction = interaction
  if (rangeMinRaw !== '') extra.rangeMin = Number(rangeMinRaw)
  if (rangeMaxRaw !== '') extra.rangeMax = Number(rangeMaxRaw)
  if (interaction === 'fillin' && inputMode === 'text') {
    extra.inputMode = 'text'
    const ph = String(formData.get('placeholder') || '').trim()
    if (ph) extra.placeholder = ph
  }

  if (Object.keys(extra).length > 0) {
    let base: Record<string, unknown> = {}
    if (mergedParamsJson) {
      try { base = JSON.parse(mergedParamsJson) } catch { base = {} }
    }
    mergedParamsJson = JSON.stringify({ ...base, ...extra })
  }

  await prisma.questionTemplate.create({
    data: { skillId, type, prompt, answer, options, explanation, paramsJson: mergedParamsJson },
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

// ============ 技能編輯 ============
export async function updateSkill(state: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin()
  const id = String(formData.get('id') || '')
  const name = String(formData.get('name') || '').trim()
  const description = String(formData.get('description') || '').trim() || null
  const gradeLevel = String(formData.get('gradeLevel') || 'G1')
  const prerequisiteId = String(formData.get('prerequisiteId') || '') || null
  const order = parseInt(String(formData.get('order') || '0'), 10)

  if (!id || !name) {
    return { message: '名稱必填' }
  }

  // 不可將自己的 dependents 設為前置（避免循環）
  if (prerequisiteId) {
    const prereq = await prisma.skill.findUnique({
      where: { id: prerequisiteId },
      include: { prerequisite: true },
    })
    // 檢查是否形成循環：前置技能是否以當前技能為前置
    let cursor = prereq
    while (cursor) {
      if (cursor.id === id) {
        return { message: '不可形成循環前置關係' }
      }
      if (!cursor.prerequisiteId) break
      cursor = await prisma.skill.findUnique({
        where: { id: cursor.prerequisiteId },
        include: { prerequisite: true },
      })
    }
  }

  await prisma.skill.update({
    where: { id },
    data: { name, description, gradeLevel, prerequisiteId, order: isNaN(order) ? 0 : order },
  })
  revalidatePath('/admin')
  revalidatePath('/admin/skills')
  return { ok: true }
}

// ============ 技能刪除（含相依檢查）============
export async function deleteSkill(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id'))

  // 檢查是否有技能以此為前置
  const dependents = await prisma.skill.findMany({
    where: { prerequisiteId: id },
  })
  if (dependents.length > 0) {
    throw new Error(`無法刪除：以下技能以此為前置技能 — ${dependents.map((d) => d.name).join('、')}`)
  }

  await prisma.skill.delete({ where: { id } })
  revalidatePath('/admin')
  revalidatePath('/admin/skills')
}

// ============ 技能排序 ============
export async function moveSkillUp(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id'))

  const skill = await prisma.skill.findUnique({ where: { id } })
  if (!skill) return

  // 找上一個（order 小於當前且最接近的）
  const prev = await prisma.skill.findFirst({
    where: { order: { lt: skill.order } },
    orderBy: { order: 'desc' },
  })
  if (!prev) return

  // 交換 order
  await prisma.skill.update({ where: { id: skill.id }, data: { order: prev.order } })
  await prisma.skill.update({ where: { id: prev.id }, data: { order: skill.order } })
  revalidatePath('/admin')
  revalidatePath('/admin/skills')
}

export async function moveSkillDown(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id'))

  const skill = await prisma.skill.findUnique({ where: { id } })
  if (!skill) return

  // 找下一個（order 大於當前且最接近的）
  const next = await prisma.skill.findFirst({
    where: { order: { gt: skill.order } },
    orderBy: { order: 'asc' },
  })
  if (!next) return

  // 交換 order
  await prisma.skill.update({ where: { id: skill.id }, data: { order: next.order } })
  await prisma.skill.update({ where: { id: next.id }, data: { order: skill.order } })
  revalidatePath('/admin')
  revalidatePath('/admin/skills')
}

// ============ 題目編輯 ============
export async function updateQuestion(state: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin()
  const id = String(formData.get('id') || '')
  const skillId = String(formData.get('skillId') || '')
  const prompt = String(formData.get('prompt') || '').trim()
  const answer = String(formData.get('answer') || '').trim()
  const options = String(formData.get('options') || '').trim() || null
  const explanation = String(formData.get('explanation') || '').trim() || null
  const paramsJson = String(formData.get('paramsJson') || '').trim() || null

  if (!id || !skillId || !prompt || !answer) {
    return { message: '技能、題目、答案為必填' }
  }

  // 讀取現有題目以取得 type（編輯時不可改 type）
  const existing = await prisma.questionTemplate.findUnique({ where: { id } })
  if (!existing) return { message: '題目不存在' }

  // 參數化題（ADD/SUB/MUL/DIV/WORD_PROBLEM）必須有合法 JSON 參數
  let mergedParamsJson: string | null = paramsJson
  if (existing.type === 'ADD' || existing.type === 'SUB' || existing.type === 'MUL' || existing.type === 'DIV' || existing.type === 'WORD_PROBLEM') {
    if (!paramsJson) {
      return { message: '參數化題型（ADD/SUB）必須填寫參數 JSON' }
    }
    try {
      const parsed = JSON.parse(paramsJson)
      if (typeof parsed.aMin !== 'number' || typeof parsed.aMax !== 'number' ||
          typeof parsed.bMin !== 'number' || typeof parsed.bMax !== 'number') {
        return { message: '參數 JSON 需包含 aMin, aMax, bMin, bMax 數字欄位' }
      }
    } catch {
      return { message: '參數 JSON 格式無效，請檢查語法' }
    }
  }

  // 合併表單的 rangeMin/rangeMax/inputMode/placeholder 到 paramsJson
  // （編輯模式 interaction 不可變更，但 rangeMin/rangeMax 可調整）
  const extra: Record<string, unknown> = {}
  const rangeMinRaw = String(formData.get('rangeMin') || '').trim()
  const rangeMaxRaw = String(formData.get('rangeMax') || '').trim()
  if (rangeMinRaw !== '') extra.rangeMin = Number(rangeMinRaw)
  if (rangeMaxRaw !== '') extra.rangeMax = Number(rangeMaxRaw)
  const inputMode = String(formData.get('inputMode') || '')
  const placeholder = String(formData.get('placeholder') || '').trim()
  if (inputMode) extra.inputMode = inputMode
  if (placeholder) extra.placeholder = placeholder

  if (Object.keys(extra).length > 0) {
    let base: Record<string, unknown> = {}
    if (mergedParamsJson) {
      try { base = JSON.parse(mergedParamsJson) } catch { base = {} }
    }
    mergedParamsJson = JSON.stringify({ ...base, ...extra })
  }

  await prisma.questionTemplate.update({
    where: { id },
    data: { skillId, prompt, answer, options, explanation, paramsJson: mergedParamsJson },
  })
  revalidatePath('/admin')
  revalidatePath('/admin/questions')
  return { ok: true }
}

// ============ 題目刪除 ============
// 採用方案 A：刪除題目前先將關聯 Attempt 的 questionId 設為 null
// 若不想實作 migration，可改用方案 B 僅停用
export async function deleteQuestion(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id'))

  // 檢查關聯作答數
  const attemptCount = await prisma.attempt.count({ where: { questionId: id } })

  // 若沒有關聯作答，直接刪除
  if (attemptCount === 0) {
    await prisma.questionTemplate.delete({ where: { id } })
    revalidatePath('/admin')
    revalidatePath('/admin/questions')
    return
  }

  // 有關聯作答 → 僅停用而不是刪除（保護歷史資料）
  await prisma.questionTemplate.update({
    where: { id },
    data: { isActive: false },
  })
  revalidatePath('/admin')
  revalidatePath('/admin/questions')
}

// ============ 資料查詢 ============
export async function getAdminStats() {
  await requireAdmin()
  const [skills, questions, attempts, children, badges] = await Promise.all([
    prisma.skill.count(),
    prisma.questionTemplate.count({ where: { isActive: true } }),
    prisma.attempt.count(),
    prisma.childProfile.count(),
    prisma.badge.count(),
  ])
  return { skills, questions, attempts, children, badges }
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

// ============ 徽章管理 ============
export type BadgeFormState =
  | { errors?: Record<string, string[]>; message?: string; ok?: boolean }
  | undefined

export async function createBadge(state: BadgeFormState, formData: FormData): Promise<BadgeFormState> {
  await requireAdmin()
  const code = String(formData.get('code') || '').trim()
  const name = String(formData.get('name') || '').trim()
  const icon = String(formData.get('icon') || '🏅').trim()
  const condition = String(formData.get('condition') || '').trim()

  if (!code || !name || !condition) {
    return { message: '代碼、名稱、條件為必填' }
  }

  try {
    await prisma.badge.create({ data: { code, name, icon, condition } })
  } catch {
    return { message: '建立失敗（代碼可能重複）' }
  }
  revalidatePath('/admin')
  revalidatePath('/admin/badges')
  return { ok: true }
}

export async function updateBadge(state: BadgeFormState, formData: FormData): Promise<BadgeFormState> {
  await requireAdmin()
  const id = String(formData.get('id') || '')
  const name = String(formData.get('name') || '').trim()
  const icon = String(formData.get('icon') || '🏅').trim()
  const condition = String(formData.get('condition') || '').trim()

  if (!name || !condition) {
    return { message: '名稱、條件為必填' }
  }

  await prisma.badge.update({ where: { id }, data: { name, icon, condition } })
  revalidatePath('/admin')
  revalidatePath('/admin/badges')
  return { ok: true }
}

export async function deleteBadge(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id'))
  // 若有孩子已獲得此徽章，先刪除關聯
  await prisma.childBadge.deleteMany({ where: { badgeId: id } })
  await prisma.badge.delete({ where: { id } })
  revalidatePath('/admin')
  revalidatePath('/admin/badges')
}

// ============ 所有孩子總覽（管理員用） ============
// 回傳全平台所有孩子檔案，附帶：
// - 完成練習次數
// - 已練習技能數 / 已掌握技能數（masteryLevel >= 0.95 且 recentTotal > 0）
// - 最近 5 次完成練習的平均正確率
// - 最近一次完成練習時間
// - 歸屬家長暱稱（若有）
export async function getAllChildrenStats() {
  await requireAdmin()
  const totalSkills = await prisma.skill.count({ where: { isActive: true } })

  const children = await prisma.childProfile.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      parent: { select: { name: true, email: true } },
      sessions: {
        where: { completedAt: { not: null } },
        orderBy: { startedAt: 'desc' },
        take: 5,
        select: { correctCount: true, totalQuestions: true, startedAt: true },
      },
      masterySnapshots: {
        select: { recentTotal: true, masteryLevel: true },
      },
      _count: {
        select: {
          sessions: { where: { completedAt: { not: null } } },
        },
      },
    },
  })

  return children.map((c) => {
    const practicedSkills = c.masterySnapshots.filter((m) => m.recentTotal > 0).length
    const masteredSkills = c.masterySnapshots.filter(
      (m) => m.recentTotal > 0 && m.masteryLevel >= 0.95
    ).length

    const lastSession = c.sessions[0]
    const recentSessions = c.sessions
    const avgAccuracy = recentSessions.length > 0
      ? Math.round(
          (recentSessions.reduce(
            (sum, s) => sum + (s.totalQuestions > 0 ? s.correctCount / s.totalQuestions : 0),
            0
          ) / recentSessions.length) * 100
        )
      : null

    return {
      id: c.id,
      nickname: c.nickname,
      email: c.email,
      gradeLevel: c.gradeLevel,
      mode: c.mode,
      stars: c.stars,
      streak: c.streak,
      lastPracticeAt: c.lastPracticeAt,
      createdAt: c.createdAt,
      parent: c.parent,
      sessionCount: c._count.sessions,
      practicedSkills,
      masteredSkills,
      totalSkills,
      skillPct: totalSkills > 0 ? Math.round((masteredSkills / totalSkills) * 100) : 0,
      lastSession,
      avgAccuracy,
    }
  })
}



