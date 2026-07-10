'use server'

// ====================================================================
// 家長報表 / 練習歷史 / 錯題本 — 資料查詢層
// --------------------------------------------------------------------
// 三個功能共用一套查詢函式：
// 1. getPracticeHistory  — 練習歷史詳情（逐題、按 session）
// 2. getWrongQuestions   — 錯題本 / 複習佇列（按技能聚合的錯題）
// 3. getGrowthReport     — 家長成長報告（週/月維度的正確率、時長、趨勢）
//
// 權限：一律走 getPracticeAuth() + canAccessChild()，與 practice.ts 一致。
// ====================================================================

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getChildSession } from '@/lib/child-session'

// ============ 練習授權輔助（與 practice.ts 同一套邏輯）============
type PracticeAuth =
  | { type: 'parent'; userId: string }
  | { type: 'child'; childId: string }
  | null

async function getPracticeAuth(): Promise<PracticeAuth> {
  const session = await getSession()
  if (session) return { type: 'parent', userId: session.userId }

  const childSession = await getChildSession()
  if (childSession) return { type: 'child', childId: childSession.childId }

  return null
}

async function canAccessChild(childId: string): Promise<boolean> {
  const auth = await getPracticeAuth()
  if (!auth) return false
  if (auth.type === 'child') return auth.childId === childId

  // 家長：確認孩子屬於這名家長，或透過 ParentChild 關聯綁定
  const child = await prisma.childProfile.findFirst({
    where: { id: childId, parentId: auth.userId },
  })
  if (child) return true

  // 綁定關聯須為 ACTIVE（學生主動綁定需家長確認後才生效）
  const link = await prisma.parentChild.findFirst({
    where: { parentId: auth.userId, childId, status: 'ACTIVE' },
  })
  return !!link
}

// ============ 型別定義 ============

/** 一筆練習歷史（含逐題詳情） */
export type PracticeHistoryItem = {
  id: string
  skillName: string
  skillId: string
  startedAt: Date
  completedAt: Date | null
  totalQuestions: number
  correctCount: number
  /** 平均每題用時（秒） */
  avgDurationSec: number
  /** 逐題詳情 */
  attempts: {
    id: string
    questionPrompt: string
    userAnswer: string
    correctAnswer: string
    isCorrect: boolean
    assisted: boolean
    durationMs: number
  }[]
}

/** 錯題本中一個技能底下的錯題聚合 */
export type WrongQuestionGroup = {
  skillId: string
  skillName: string
  gradeLevel: string
  masteryLevel: number
  /** 該技能下最近的錯題（去重，最多 N 題） */
  items: {
    id: string
    questionPrompt: string
    userAnswer: string
    correctAnswer: string
    wrongCount: number
    lastWrongAt: Date
    durationMs: number
  }[]
}

/** 成長報告 */
export type GrowthReport = {
  child: {
    id: string
    nickname: string
    gradeLevel: string
    stars: number
    streak: number
  }
  /** 區間總覽 */
  summary: {
    totalSessions: number
    totalQuestions: number
    correctCount: number
    accuracy: number
    totalPracticeMin: number
  }
  /** 每日趨勢（供折線圖） */
  dailyTrend: {
    date: string // YYYY-MM-DD
    sessions: number
    questions: number
    correct: number
    accuracy: number
    durationMin: number
  }[]
  /** 各技能表現（供家長看出強弱項） */
  skillBreakdown: {
    skillId: string
    skillName: string
    gradeLevel: string
    recentCorrect: number
    recentTotal: number
    accuracy: number
    masteryLevel: number
  }[]
}

// ============ 1. 練習歷史詳情 ============

/**
 * 取得孩子的練習歷史（含逐題詳情）。
 * @param childId 孩子ID
 * @param limit   最多回傳幾筆 session（預設 20）
 */
export async function getPracticeHistory(
  childId: string,
  limit = 20
): Promise<PracticeHistoryItem[] | null> {
  const auth = await getPracticeAuth()
  if (!auth || !(await canAccessChild(childId))) return null

  // 防濫用：限制查詢範圍
  const safeLimit = Math.min(Math.max(limit, 1), 100)

  const sessions = await prisma.practiceSession.findMany({
    where: { childId, status: 'COMPLETED' },
    orderBy: { startedAt: 'desc' },
    take: safeLimit,
    include: {
      skill: { select: { id: true, name: true } },
      attempts: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          questionPrompt: true,
          userAnswer: true,
          correctAnswer: true,
          isCorrect: true,
          assisted: true,
          durationMs: true,
        },
      },
    },
  })

  return sessions.map((s) => {
    const totalMs = s.attempts.reduce((sum, a) => sum + a.durationMs, 0)
    const avgDurationSec =
      s.attempts.length > 0 ? Math.round(totalMs / s.attempts.length / 1000) : 0
    return {
      id: s.id,
      skillName: s.skill.name,
      skillId: s.skill.id,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      totalQuestions: s.totalQuestions,
      correctCount: s.correctCount,
      avgDurationSec,
      attempts: s.attempts,
    }
  })
}

// ============ 2. 錯題本 / 複習佇列 ============

/**
 * 取得孩子的錯題本：按技能聚合的錯題（非 assisted 才算）。
 * 用 questionPrompt 去重，統計每題被答錯幾次，方便家長看出反覆出錯的題型。
 * @param childId 孩子ID
 * @param limit   每個技能最多回傳幾題錯題（預設 5）
 */
export async function getWrongQuestions(
  childId: string,
  perSkillLimit = 5
): Promise<WrongQuestionGroup[] | null> {
  const auth = await getPracticeAuth()
  if (!auth || !(await canAccessChild(childId))) return null

  // 取得所有錯題（非 assisted），含所屬技能
  const wrongAttempts = await prisma.attempt.findMany({
    where: {
      isCorrect: false,
      assisted: false,
      session: { childId },
    },
    orderBy: { createdAt: 'desc' },
    take: 500, // 上限保護，避免一次撈太多
    include: {
      session: {
        select: {
          skill: { select: { id: true, name: true, gradeLevel: true } },
        },
      },
    },
  })

  // 掌握度快照（用於顯示每個技能的當前掌握度）
  const snapshots = await prisma.masterySnapshot.findMany({
    where: { childId },
    select: { skillId: true, masteryLevel: true },
  })
  const masteryMap = new Map(snapshots.map((m) => [m.skillId, m.masteryLevel]))

  // 按技能分組：技能 → (題目文字 → 錯題聚合)
  // 同一題目被答錯多次時，累計 wrongCount 並保留最近一次作答
  const perSkill = new Map<
    string,
    { group: WrongQuestionGroup; items: Map<string, WrongQuestionGroup['items'][number]> }
  >()

  for (const a of wrongAttempts) {
    const skill = a.session.skill
    if (!perSkill.has(skill.id)) {
      perSkill.set(skill.id, {
        group: {
          skillId: skill.id,
          skillName: skill.name,
          gradeLevel: skill.gradeLevel,
          masteryLevel: masteryMap.get(skill.id) ?? 0,
          items: [],
        },
        items: new Map(),
      })
    }
    const entry = perSkill.get(skill.id)!
    const existing = entry.items.get(a.questionPrompt)
    if (existing) {
      existing.wrongCount += 1
      // 保留最近一次的作答與時間
      if (a.createdAt > existing.lastWrongAt) {
        existing.lastWrongAt = a.createdAt
        existing.userAnswer = a.userAnswer
      }
    } else {
      entry.items.set(a.questionPrompt, {
        id: a.id,
        questionPrompt: a.questionPrompt,
        userAnswer: a.userAnswer,
        correctAnswer: a.correctAnswer,
        wrongCount: 1,
        lastWrongAt: a.createdAt,
        durationMs: a.durationMs,
      })
    }
  }

  // 每個技能取最多 perSkillLimit 題，按錯誤次數降序；技能間按掌握度升序（最弱排前）
  return [...perSkill.values()]
    .map((entry) => {
      entry.group.items = [...entry.items.values()]
        .sort((x, y) => y.wrongCount - x.wrongCount)
        .slice(0, perSkillLimit)
      return entry.group
    })
    .sort((a, b) => a.masteryLevel - b.masteryLevel)
}

// ============ 3. 家長成長報告 ============

/**
 * 取得孩子的成長報告。
 * @param childId  孩子ID
 * @param days     統計區間天數（預設 30 天）
 */
export async function getGrowthReport(
  childId: string,
  days = 30
): Promise<GrowthReport | null> {
  const auth = await getPracticeAuth()
  if (!auth || !(await canAccessChild(childId))) return null

  const child = await prisma.childProfile.findUnique({
    where: { id: childId },
    select: { id: true, nickname: true, gradeLevel: true, stars: true, streak: true },
  })
  if (!child) return null

  // 防濫用：限制查詢範圍
  const safeDays = Math.min(Math.max(days, 1), 365)

  const since = new Date()
  since.setDate(since.getDate() - safeDays)
  since.setHours(0, 0, 0, 0)

  // 區間內完成的練習（含 attempts）
  const sessions = await prisma.practiceSession.findMany({
    where: { childId, completedAt: { gte: since } },
    orderBy: { startedAt: 'asc' },
    include: {
      skill: { select: { id: true, name: true, gradeLevel: true } },
      attempts: { select: { isCorrect: true, assisted: true, durationMs: true, createdAt: true } },
    },
  })

  // 匯總（不計 assisted）
  let totalQuestions = 0
  let correctCount = 0
  let totalMs = 0
  const dailyMap = new Map<string, { sessions: number; questions: number; correct: number; durationMs: number }>()

  for (const s of sessions) {
    const legit = s.attempts.filter((a) => !a.assisted)
    totalQuestions += legit.length
    correctCount += legit.filter((a) => a.isCorrect).length
    totalMs += legit.reduce((sum, a) => sum + a.durationMs, 0)

    const dayKey = localDateKey(s.startedAt)
    const d = dailyMap.get(dayKey) ?? { sessions: 0, questions: 0, correct: 0, durationMs: 0 }
    d.sessions += 1
    d.questions += legit.length
    d.correct += legit.filter((a) => a.isCorrect).length
    d.durationMs += legit.reduce((sum, a) => sum + a.durationMs, 0)
    dailyMap.set(dayKey, d)
  }

  // 每日趨勢：補齊區間內沒有練習的日子為 0
  const dailyTrend: GrowthReport['dailyTrend'] = []
  const cursor = new Date(since)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  while (cursor <= today) {
    const key = localDateKey(cursor)
    const d = dailyMap.get(key)
    dailyTrend.push({
      date: key,
      sessions: d?.sessions ?? 0,
      questions: d?.questions ?? 0,
      correct: d?.correct ?? 0,
      accuracy: d && d.questions > 0 ? Math.round((d.correct / d.questions) * 100) : 0,
      durationMin: d ? Math.round(d.durationMs / 60000) : 0,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  // 技能表現（用掌握度快照 + 區間 attempts 補充正確率）
  const snapshots = await prisma.masterySnapshot.findMany({
    where: { childId },
    select: {
      skillId: true,
      recentCorrect: true,
      recentTotal: true,
      masteryLevel: true,
      skill: { select: { name: true, gradeLevel: true } },
    },
  })

  const skillBreakdown: GrowthReport['skillBreakdown'] = snapshots
    .filter((s) => s.recentTotal > 0)
    .map((s) => ({
      skillId: s.skillId,
      skillName: s.skill.name,
      gradeLevel: s.skill.gradeLevel,
      recentCorrect: s.recentCorrect,
      recentTotal: s.recentTotal,
      accuracy: s.recentTotal > 0 ? Math.round((s.recentCorrect / s.recentTotal) * 100) : 0,
      masteryLevel: Math.round(s.masteryLevel * 100),
    }))
    .sort((a, b) => a.accuracy - b.accuracy)

  return {
    child,
    summary: {
      totalSessions: sessions.length,
      totalQuestions,
      correctCount,
      accuracy: totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0,
      totalPracticeMin: Math.round(totalMs / 60000),
    },
    dailyTrend,
    skillBreakdown,
  }
}

// ============ 共用工具 ============

/** 把日期轉成當地時區的 YYYY-MM-DD（避免 UTC 偏差） */
function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
