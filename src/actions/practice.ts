'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { generateQuestion } from '@/lib/question'
import { updateMastery, getRecommendation } from '@/lib/mastery'

const QUESTIONS_PER_SESSION = 10

// 開始一次練習：回傳 { sessionId, skill } 給做題頁
export async function startSession(childId: string, skillId: string) {
  const session = await getSession()
  if (!session) throw new Error('未授權')

  // 確認孩子屬於這名家長
  const child = await prisma.childProfile.findFirst({
    where: { id: childId, parentId: session.userId },
  })
  if (!child) throw new Error('找不到孩子檔案')

  const practiceSession = await prisma.practiceSession.create({
    data: {
      childId,
      skillId,
      parentId: session.userId,
      totalQuestions: QUESTIONS_PER_SESSION,
    },
  })

  redirect(`/practice/${childId}/${skillId}/${practiceSession.id}`)
}

// 取得一次練習要做的題目（從模板產生實例）
export async function getSessionQuestions(
  sessionId: string
): Promise<{ questions: ReturnType<typeof generateQuestion>[]; skillName: string; childNickname: string } | null> {
  const session = await getSession()
  if (!session) return null

  const practiceSession = await prisma.practiceSession.findUnique({
    where: { id: sessionId },
    include: {
      skill: { include: { questions: { where: { isActive: true } } } },
      child: true,
    },
  })
  if (!practiceSession) return null

  // 驗證家長擁有這個孩子
  if (practiceSession.child.parentId !== session.userId) return null

  const templates = practiceSession.skill.questions
  // 不夠題目就重複取樣（保證有題可做）
  const picked: typeof templates = []
  for (let i = 0; i < QUESTIONS_PER_SESSION; i++) {
    picked.push(templates[i % templates.length])
  }

  const questions = picked.map((t) =>
    generateQuestion({
      id: t.id,
      type: t.type,
      prompt: t.prompt,
      paramsJson: t.paramsJson,
      answer: t.answer,
      options: t.options,
    })
  )

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

// 提交一題作答
export async function submitAnswer(payload: {
  sessionId: string
  questionId: string
  questionPrompt: string
  userAnswer: string
  correctAnswer: string
  assisted: boolean
  durationMs: number
}): Promise<SubmitResult> {
  const session = await getSession()
  if (!session) throw new Error('未授權')

  const correct = payload.userAnswer.trim() === payload.correctAnswer.trim()

  await prisma.attempt.create({
    data: {
      sessionId: payload.sessionId,
      questionId: payload.questionId,
      questionPrompt: payload.questionPrompt,
      userAnswer: payload.userAnswer,
      correctAnswer: payload.correctAnswer,
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
  const total = (
    await prisma.practiceSession.findUnique({ where: { id: payload.sessionId } })
  )?.totalQuestions ?? QUESTIONS_PER_SESSION

  const finished = count >= total
  if (finished) {
    await prisma.practiceSession.update({
      where: { id: payload.sessionId },
      data: { completedAt: new Date() },
    })
    // 更新掌握度快照
    await updateMastery(payload.sessionId)
  }

  revalidatePath('/dashboard')
  revalidatePath(`/children`)

  return { correct, correctAnswer: payload.correctAnswer, finished, sessionId: payload.sessionId }
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
