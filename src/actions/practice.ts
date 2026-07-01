'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { generateQuestion, shuffle } from '@/lib/question'
import { updateMastery, getRecommendation } from '@/lib/mastery'

const QUESTIONS_PER_SESSION = 10

type StoredQuestion = {
  templateId: string
  prompt: string
  answer: string
  options?: string[]
  explanation?: string
}

// 開始一次練習：在伺服器生成題目快照後建立 session
export async function startSession(childId: string, skillId: string) {
  const session = await getSession()
  if (!session) throw new Error('未授權')

  // 確認孩子屬於這名家長
  const child = await prisma.childProfile.findFirst({
    where: { id: childId, parentId: session.userId },
  })
  if (!child) throw new Error('找不到孩子檔案')

  const skill = await prisma.skill.findUnique({
    where: { id: skillId },
    include: { questions: { where: { isActive: true } } },
  })
  if (!skill || !skill.isActive) throw new Error('技能不存在或已停用')
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
    generated.push({
      templateId: q.templateId!,
      prompt: q.prompt,
      answer: q.answer,
      options: q.options,
      explanation: t.explanation ?? undefined,
    })
  }

  const practiceSession = await prisma.practiceSession.create({
    data: {
      childId,
      skillId,
      parentId: session.userId,
      totalQuestions: QUESTIONS_PER_SESSION,
      questionsJson: JSON.stringify(generated),
    },
  })

  redirect(`/practice/${childId}/${skillId}/${practiceSession.id}`)
}

// 取得一次練習要做的題目（從 session 的伺服器快照讀取，確保與驗證一致）
export async function getSessionQuestions(
  sessionId: string
): Promise<{ questions: StoredQuestion[]; skillName: string; childNickname: string } | null> {
  const session = await getSession()
  if (!session) return null

  const practiceSession = await prisma.practiceSession.findUnique({
    where: { id: sessionId },
    include: { skill: true, child: true },
  })
  if (!practiceSession) return null

  // 驗證家長擁有這個孩子
  if (practiceSession.child.parentId !== session.userId) return null

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
  const session = await getSession()
  if (!session) throw new Error('未授權')

  const practiceSession = await prisma.practiceSession.findUnique({
    where: { id: payload.sessionId },
    include: { child: true },
  })
  // 越權防護：session 必須存在且屬於當前家長的孩子
  if (!practiceSession || practiceSession.child.parentId !== session.userId) {
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
  }

  revalidatePath('/dashboard')
  revalidatePath('/children')

  return { correct, correctAnswer, finished, sessionId: payload.sessionId, explanation: q.explanation }
}

// 取得孩子的技能選單與推薦
export async function getChildSkills(childId: string) {
  const session = await getSession()
  if (!session) return null

  const child = await prisma.childProfile.findFirst({
    where: { id: childId, parentId: session.userId },
    include: { masterySnapshots: { include: { skill: true } } },
  })
  if (!child) return null

  const skills = await prisma.skill.findMany({
    where: { isActive: true },
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
