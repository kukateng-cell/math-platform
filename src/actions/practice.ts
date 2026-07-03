'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getChildSession } from '@/lib/child-session'
import { generateQuestion, shuffle } from '@/lib/question'
import { updateMastery, getRecommendation } from '@/lib/mastery'
import { updateStars, updateStreak, checkBadges } from '@/lib/gamification'
import { accessibleGrades, canAccessGrade } from '@/lib/grade'

const QUESTIONS_PER_SESSION = 10

// ============ 練習授權輔助函式 ============
// 練習路由同時支援「家長 session」與「孩子 session」兩種身分：
// - 家長：透過 getSession()，可存取自己建立的所有孩子
// - 孩子（家長建檔 / 自主學習）：透過 getChildSession()，只能存取自己的檔案
type PracticeAuth =
  | { type: 'parent'; userId: string }
  | { type: 'child'; childId: string }
  | null

async function getPracticeAuth(): Promise<PracticeAuth> {
  // 先嘗試家長 session
  const session = await getSession()
  if (session) return { type: 'parent', userId: session.userId }

  // 再嘗試孩子 session
  const childSession = await getChildSession()
  if (childSession) return { type: 'child', childId: childSession.childId }

  return null
}

// 驗證目前身分是否有權存取指定的孩子
async function canAccessChild(childId: string): Promise<boolean> {
  const auth = await getPracticeAuth()
  if (!auth) return false
  if (auth.type === 'child') return auth.childId === childId

  // 家長：確認孩子屬於這名家長，或透過 ParentChild 關聯綁定
  const child = await prisma.childProfile.findFirst({
    where: { id: childId, parentId: auth.userId },
  })
  if (child) return true

  const link = await prisma.parentChild.findFirst({
    where: { parentId: auth.userId, childId },
  })
  return !!link
}

// 供頁面元件使用：檢查是否有任何練習身分（家長或孩子）
export async function hasPracticeAccess(): Promise<boolean> {
  return (await getPracticeAuth()) !== null
}

type StoredQuestion = {
  templateId: string
  prompt: string
  answer: string
  options?: string[]
  explanation?: string
  /** 互動模式：choice (預設) / numberline / fillin */
  interaction?: string
  /** 數字線範圍 */
  rangeMin?: number
  rangeMax?: number
}

// 開始一次練習：在伺服器生成題目快照後建立 session
export async function startSession(childId: string, skillId: string) {
  const auth = await getPracticeAuth()
  if (!auth) throw new Error('未授權')

  // 確認身分可存取這個孩子
  if (!(await canAccessChild(childId))) throw new Error('找不到孩子檔案')

  const child = await prisma.childProfile.findUnique({ where: { id: childId } })
  if (!child) throw new Error('找不到孩子檔案')

  const skill = await prisma.skill.findUnique({
    where: { id: skillId },
    include: { questions: { where: { isActive: true } } },
  })
  if (!skill || !skill.isActive) throw new Error('技能不存在或已停用')
  // 年級權限：低年級不可練習高年級的技能（避免知道 ID 就能越級）
  if (!canAccessGrade(child.gradeLevel, skill.gradeLevel)) {
    throw new Error('這個技能超出您的年級範圍')
  }
  // 空題庫保護
  if (skill.questions.length === 0) {
    throw new Error('這個技能目前沒有題目，請聯繫管理員')
  }

  // 伺服器端生成題目實例（打亂模板順序，讓每次練習不同）
  const templates = shuffle(skill.questions)
  const generated: StoredQuestion[] = []
  for (let i = 0; i < QUESTIONS_PER_SESSION; i++) {
    const t = templates[i % templates.length]
    const q = generateQuestion({
      id: t.id,
      type: t.type,
      prompt: t.prompt,
      paramsJson: t.paramsJson,
      answer: t.answer,
      options: t.options,
    })

    // 解析互動模式（從 paramsJson）
    let interaction: string | undefined
    let rangeMin: number | undefined
    let rangeMax: number | undefined
    if (t.paramsJson) {
      try {
        const parsed = JSON.parse(t.paramsJson)
        interaction = parsed.interaction
        rangeMin = parsed.rangeMin
        rangeMax = parsed.rangeMax
      } catch { /* ignore */ }
    }

    generated.push({
      templateId: q.templateId!,
      prompt: q.prompt,
      answer: q.answer,
      options: q.options,
      explanation: t.explanation ?? undefined,
      interaction,
      rangeMin,
      rangeMax,
    })
  }

  const practiceSession = await prisma.practiceSession.create({
    data: {
      childId,
      skillId,
      parentId: auth.type === 'parent' ? auth.userId : child.parentId,
      totalQuestions: QUESTIONS_PER_SESSION,
      questionsJson: JSON.stringify(generated),
    },
  })

  redirect(`/practice/${childId}/${skillId}/${practiceSession.id}`)
}

// 取得一次練習要做的題目（從 session 的伺服器快照讀取，確保與驗證一致）
export async function getSessionQuestions(
  sessionId: string
): Promise<{
  questions: (StoredQuestion & { interaction?: string; rangeMin?: number; rangeMax?: number })[]
  skillName: string
  childNickname: string
} | null> {
  const auth = await getPracticeAuth()
  if (!auth) {
    console.error('getSessionQuestions: no session')
    return null
  }

  const practiceSession = await prisma.practiceSession.findUnique({
    where: { id: sessionId },
    include: { skill: true, child: true },
  })
  if (!practiceSession) {
    console.error('Session not found in DB:', sessionId)
    return null
  }

  // 驗證身分可存取此練習
  if (!(await canAccessChild(practiceSession.childId))) return null

  // 相容舊 session：若無 questionsJson，回傳空陣列讓前端顯示提示
  let questions: StoredQuestion[] = []
  if (practiceSession.questionsJson) {
    try {
      questions = JSON.parse(practiceSession.questionsJson)
    } catch {
      questions = []
    }
  }

  return {
    questions,
    skillName: practiceSession.skill.name,
    childNickname: practiceSession.child.nickname,
  }
}

export type SubmitResult = {
  correct: boolean
  correctAnswer: string
  finished: boolean
  sessionId: string
  explanation?: string
}

// 提交一題作答（伺服器從快照重算正確答案，不信任前端）
export async function submitAnswer(payload: {
  sessionId: string
  questionIndex: number // 這題在 session 快照中的索引
  userAnswer: string
  assisted: boolean
  durationMs: number
}): Promise<SubmitResult> {
  const auth = await getPracticeAuth()
  if (!auth) throw new Error('未授權')

  const practiceSession = await prisma.practiceSession.findUnique({
    where: { id: payload.sessionId },
    include: { child: true },
  })
  // 越權防護：session 必須存在且身分可存取此孩子
  if (!practiceSession || !(await canAccessChild(practiceSession.childId))) {
    throw new Error('無權存取此練習')
  }
  // 已完成的練習不再接受作答（防重複提交）
  if (practiceSession.completedAt) {
    return {
      correct: false,
      correctAnswer: '',
      finished: true,
      sessionId: payload.sessionId,
    }
  }

  // 從伺服器快照取出這題的正確答案
  const questions: StoredQuestion[] = practiceSession.questionsJson
    ? JSON.parse(practiceSession.questionsJson)
    : []
  const q = questions[payload.questionIndex]
  if (!q) throw new Error('題目不存在')

  const correctAnswer = q.answer
  const correct = payload.userAnswer.trim() === correctAnswer.trim()

  await prisma.attempt.create({
    data: {
      sessionId: payload.sessionId,
      questionId: q.templateId,
      questionPrompt: q.prompt,
      userAnswer: payload.userAnswer,
      correctAnswer,
      isCorrect: correct,
      assisted: payload.assisted,
      durationMs: payload.durationMs,
    },
  })

  // 更新練習的正確數（不計 assisted 題）
  if (correct && !payload.assisted) {
    await prisma.practiceSession.update({
      where: { id: payload.sessionId },
      data: { correctCount: { increment: 1 } },
    })
  }

  // 檢查是否完成
  const count = await prisma.attempt.count({ where: { sessionId: payload.sessionId } })
  const total = practiceSession.totalQuestions
  const finished = count >= total
  if (finished) {
    await prisma.practiceSession.update({
      where: { id: payload.sessionId },
      data: { completedAt: new Date() },
    })
    await updateMastery(payload.sessionId)

    // ============ 遊戲化 ============
    const childId = practiceSession.childId
    // 查詢本次練習的正確數（不計 assisted）= 星星數
    const sessionAttempts = await prisma.attempt.findMany({
      where: { sessionId: payload.sessionId },
    })
    const starsEarned = sessionAttempts.filter(
      (a) => a.isCorrect && !a.assisted
    ).length
    const allCorrect = sessionAttempts.every(
      (a) => a.isCorrect
    )

    await updateStars(childId, starsEarned)
    await updateStreak(childId)
    await checkBadges({
      childId,
      sessionCorrectCount: starsEarned,
      sessionTotalQuestions: total,
      allCorrect,
    })
  }

  revalidatePath('/dashboard')
  revalidatePath('/children')

  return { correct, correctAnswer, finished, sessionId: payload.sessionId, explanation: q.explanation }
}

// 取得孩子的技能選單與推薦
export async function getChildSkills(childId: string) {
  const auth = await getPracticeAuth()
  if (!auth) return null

  // 驗證身分可存取這個孩子
  if (!(await canAccessChild(childId))) return null

  const child = await prisma.childProfile.findUnique({
    where: { id: childId },
    include: { masterySnapshots: { include: { skill: true } } },
  })
  if (!child) return null

  // 年級權限：低年級不可看高年級；高年級可往下複習低年級
  const grades = accessibleGrades(child.gradeLevel)

  const skills = await prisma.skill.findMany({
    where: { isActive: true, gradeLevel: { in: grades } },
    orderBy: { order: 'asc' },
    include: { _count: { select: { questions: { where: { isActive: true } } } } },
  })

  return {
    child,
    skills: skills.map((s) => {
      const mastery = child.masterySnapshots.find((m) => m.skillId === s.id)
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        gradeLevel: s.gradeLevel,
        questionCount: s._count.questions,
        masteryLevel: mastery?.masteryLevel ?? 0,
        recentCorrect: mastery?.recentCorrect ?? 0,
        recentTotal: mastery?.recentTotal ?? 0,
      }
    }),
    recommendation: getRecommendation(skills, child.masterySnapshots),
  }
}
