'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getVerifiedSession } from '@/lib/session'
import { accessibleGrades } from '@/lib/grade'
import { QuestionParamsSchema } from '@/lib/definitions'

// P1-10：有效的年級值（與 Prisma GradeLevel enum 一致）
const VALID_GRADE_LEVELS = ['K', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'] as const

// 管理員授權檢查（每個 action 都要先驗）
// 使用 getVerifiedSession() 查 DB 確認 role 和 tokenVersion，
// 確保降級後的舊 JWT session 無法繼續執行管理操作。
async function requireAdmin() {
  const session = await getVerifiedSession()
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

  // P1-10：驗證 gradeLevel 是否為有效值
  if (!VALID_GRADE_LEVELS.includes(gradeLevel as typeof VALID_GRADE_LEVELS[number])) {
    return { message: '無效的年級' }
  }

  try {
    await prisma.skill.create({
      data: { code, name, description, gradeLevel, prerequisiteId },
    })
  } catch {
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
  // P0-1：hint 為作答前可安全顯示的提示（不含答案）
  const hint = String(formData.get('hint') || '').trim() || null
  const paramsJsonRaw = String(formData.get('paramsJson') || '').trim()

  if (!skillId || !prompt || !answer) {
    return { message: '技能、題目、答案為必填' }
  }

  // P2-13：runtime 驗證 type 是否為合法值
  const validTypes = ['DIRECT', 'ADD', 'SUB', 'MUL', 'DIV', 'WORD_PROBLEM'] as const
  type ValidType = typeof validTypes[number]
  if (!validTypes.includes(type as ValidType)) {
    return { message: '無效的題目類型' }
  }

  // 參數化題（ADD/SUB/MUL/DIV/WORD_PROBLEM）必須有合法 JSON 參數
  let mergedParamsJson: string | null = paramsJsonRaw || null
  if (type === 'ADD' || type === 'SUB' || type === 'MUL' || type === 'DIV' || type === 'WORD_PROBLEM') {
    if (!paramsJsonRaw) {
      return { message: '參數化題型必須填寫參數 JSON' }
    }
    try {
      const parsed = JSON.parse(paramsJsonRaw)
      // P1-8：注入 type 欄位供 discriminated union 驗證
      if (!parsed.type) parsed.type = type
      const result = QuestionParamsSchema.safeParse(parsed)
      if (!result.success) {
        return { message: `參數驗證失敗：${result.error.errors.map((e) => e.message).join('；')}` }
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

  // P1-8：驗證最終合併後的 JSON（包含合併後的 interaction/rangeMin/rangeMax/inputMode）
  if (mergedParamsJson && (type === 'ADD' || type === 'SUB' || type === 'MUL' || type === 'DIV' || type === 'WORD_PROBLEM')) {
    try {
      const mergedParsed = JSON.parse(mergedParamsJson)
      if (!mergedParsed.type) mergedParsed.type = type
      const mergedResult = QuestionParamsSchema.safeParse(mergedParsed)
      if (!mergedResult.success) {
        return { message: `合併後參數驗證失敗：${mergedResult.error.errors.map((e) => e.message).join('；')}` }
      }
    } catch {
      return { message: '合併後的參數 JSON 無效' }
    }
  }

  await prisma.questionTemplate.create({
    data: { skillId, type, prompt, answer, options, explanation, hint, paramsJson: mergedParamsJson },
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

  // P1-10：驗證 gradeLevel 是否為有效值
  if (!VALID_GRADE_LEVELS.includes(gradeLevel as typeof VALID_GRADE_LEVELS[number])) {
    return { message: '無效的年級' }
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

  // 檢查是否有歷史資料（session / question / mastery）
  const [sessionCount, questionCount, masteryCount] = await Promise.all([
    prisma.practiceSession.count({ where: { skillId: id } }),
    prisma.questionTemplate.count({ where: { skillId: id } }),
    prisma.masterySnapshot.count({ where: { skillId: id } }),
  ])

  if (sessionCount > 0 || questionCount > 0 || masteryCount > 0) {
    // 已有歷史資料 → 只允許停用，保留關聯資料
    await prisma.skill.update({ where: { id }, data: { isActive: false } })
  } else {
    // 完全未使用 → 可安全刪除
    await prisma.skill.delete({ where: { id } })
  }
  revalidatePath('/admin')
  revalidatePath('/admin/skills')
}

// ============ 技能排序 ============
export async function moveSkillUp(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id'))

  const skill = await prisma.skill.findUnique({ where: { id } })
  if (!skill) return

  // 找上一個（同年級內 order 小於當前且最接近的）
  const prev = await prisma.skill.findFirst({
    where: { gradeLevel: skill.gradeLevel, order: { lt: skill.order } },
    orderBy: { order: 'desc' },
  })
  if (!prev) return

  // P2-13：使用 transaction 確保聯盟交換的原子性
  await prisma.$transaction([
    prisma.skill.update({ where: { id: skill.id }, data: { order: prev.order } }),
    prisma.skill.update({ where: { id: prev.id }, data: { order: skill.order } }),
  ])
  revalidatePath('/admin')
  revalidatePath('/admin/skills')
}

export async function moveSkillDown(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id'))

  const skill = await prisma.skill.findUnique({ where: { id } })
  if (!skill) return

  // 找下一個（同年級內 order 大於當前且最接近的）
  const next = await prisma.skill.findFirst({
    where: { gradeLevel: skill.gradeLevel, order: { gt: skill.order } },
    orderBy: { order: 'asc' },
  })
  if (!next) return

  // P2-13：使用 transaction 確保聯盟交換的原子性
  await prisma.$transaction([
    prisma.skill.update({ where: { id: skill.id }, data: { order: next.order } }),
    prisma.skill.update({ where: { id: next.id }, data: { order: skill.order } }),
  ])
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
  // P0-1：hint 為作答前可安全顯示的提示（不含答案）
  const hint = String(formData.get('hint') || '').trim() || null
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
      return { message: '參數化題型必須填寫參數 JSON' }
    }
    try {
      const parsed = JSON.parse(paramsJson)
      // P1-8：注入 type 欄位供 discriminated union 驗證
      if (!parsed.type) parsed.type = existing.type
      const result = QuestionParamsSchema.safeParse(parsed)
      if (!result.success) {
        return { message: `參數驗證失敗：${result.error.errors.map((e) => e.message).join('；')}` }
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

  // P1-8：驗證最終合併後的 JSON
  if (mergedParamsJson && (existing.type === 'ADD' || existing.type === 'SUB' || existing.type === 'MUL' || existing.type === 'DIV' || existing.type === 'WORD_PROBLEM')) {
    try {
      const mergedParsed = JSON.parse(mergedParamsJson)
      if (!mergedParsed.type) mergedParsed.type = existing.type
      const mergedResult = QuestionParamsSchema.safeParse(mergedParsed)
      if (!mergedResult.success) {
        return { message: `合併後參數驗證失敗：${mergedResult.error.errors.map((e) => e.message).join('；')}` }
      }
    } catch {
      return { message: '合併後的參數 JSON 無效' }
    }
  }

  await prisma.questionTemplate.update({
    where: { id },
    data: { skillId, prompt, answer, options, explanation, hint, paramsJson: mergedParamsJson },
  })
  revalidatePath('/admin')
  revalidatePath('/admin/questions')
  return { ok: true }
}

// ============ 題目刪除（P1-7：一律 soft delete）============
// 永遠只停用（isActive = false）而非 hard delete，保護歷史資料。
// 即使目前無關聯作答，hard delete 仍可能影響正在進行中的 active session
// （session 的 questionsJson 快照中存有 templateId，若題目被徹底刪除，
//  submitAnswer 時 foreign key 約束會失敗，導致 session 卡死）。
// 改為一律 soft delete，確保所有 active session 都能正常完成。
export async function deleteQuestion(formData: FormData) {
  await requireAdmin()

  const id = String(formData.get('id'))
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
  // P2-13：clamp limit 避免記憶體爆量
  const safeLimit = Math.min(Math.max(1, limit), 1000)
  return prisma.attempt.findMany({
    orderBy: { createdAt: 'desc' },
    take: safeLimit,
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
  const icon = String(formData.get('icon') || 'medal').trim()
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
  const icon = String(formData.get('icon') || 'medal').trim()
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
  // P2-13：改為停用而非刪除（保留孩子已獲得的歷史徽章）
  // 檢查是否有孩子已獲得此徽章
  const childCount = await prisma.childBadge.count({ where: { badgeId: id } })
  if (childCount > 0) {
    // 有歷史資料 → 只停用（孩子已獲得的徽章仍顯示在他們的成就頁面）
    await prisma.badge.update({ where: { id }, data: { isActive: false } })
  } else {
    // 無歷史資料 → 可安全刪除
    await prisma.badge.delete({ where: { id } })
  }
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

  const children = await prisma.childProfile.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      parent: { select: { name: true, email: true } },
      sessions: {
        where: { status: 'COMPLETED' },
        orderBy: { startedAt: 'desc' },
        take: 5,
        select: { correctCount: true, totalQuestions: true, gradedQuestionCount: true, startedAt: true },
      },
      masterySnapshots: {
        select: { recentTotal: true, masteryLevel: true },
      },
      _count: {
        select: {
          sessions: { where: { status: 'COMPLETED' } },
        },
      },
    },
  })

  // 預查所有年級的有效技能數（供各孩子計算可觸及技能數）
  const skillsByGrade = await prisma.skill.groupBy({
    by: ['gradeLevel'],
    where: { isActive: true },
    _count: { id: true },
  })
  const skillsCountByGrade = new Map(skillsByGrade.map((s) => [s.gradeLevel, s._count.id]))

  return children.map((c) => {
    // 按孩子 gradeLevel 計算可觸及的技能數（與 Dashboard 一致）
    const grades = accessibleGrades(c.gradeLevel)
    const totalSkills = grades.reduce((sum, g) => sum + (skillsCountByGrade.get(g) ?? 0), 0)
    const practicedSkills = c.masterySnapshots.filter((m) => m.recentTotal > 0).length
    const masteredSkills = c.masterySnapshots.filter(
      (m) => m.recentTotal > 0 && m.masteryLevel >= 0.95
    ).length

    const lastSession = c.sessions[0]
    const recentSessions = c.sessions
    const avgAccuracy = recentSessions.length > 0
      ? Math.round(
          (recentSessions.reduce(
            (sum, s) => sum + ((s.gradedQuestionCount || s.totalQuestions) > 0 ? s.correctCount / (s.gradedQuestionCount || s.totalQuestions) : 0),
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



