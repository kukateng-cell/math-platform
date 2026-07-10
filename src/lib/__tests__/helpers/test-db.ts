/**
 * DB Integration Test Helpers
 *
 * 提供測試用 PostgreSQL 連線與 PrismaClient，搭配 .env.test 中的 DATABASE_URL。
 * CI 環境使用 GitHub Actions 的 PostgreSQL service container。
 *
 * 用法：
 *   import { prisma, createTestChild, createTestParent } from './helpers/test-db'
 *
 *   afterAll(async () => await prisma.$disconnect())
 */

import 'dotenv/config'
import { PrismaClient } from '@/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

// 讀取測試環境變數（vitest 會載入 .env.test）

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL not set — integration tests require a PostgreSQL database')
}

import pg from 'pg'
const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool)
export const prisma = new PrismaClient({ adapter })

/** 清理測試資料（依外鍵順序） */
export async function cleanDatabase() {
  await prisma.attempt.deleteMany({})
  await prisma.practiceSession.deleteMany({})
  await prisma.masterySnapshot.deleteMany({})
  await prisma.childBadge.deleteMany({})
  await prisma.passwordResetGrant.deleteMany({})
  await prisma.pendingSignup.deleteMany({})
  await prisma.otpCode.deleteMany({})
  await prisma.parentChild.deleteMany({})
  await prisma.childProfile.deleteMany({})
  await prisma.questionTemplate.deleteMany({})
  await prisma.skill.deleteMany({})
  await prisma.user.deleteMany({})
  await prisma.badge.deleteMany({})
}

/** 建立測試家長 */
export async function createTestParent(overrides: {
  email?: string
  name?: string
  password?: string
  role?: 'PARENT' | 'ADMIN'
} = {}) {
  const email = overrides.email || `parent_${Date.now()}@test.local`
  const passwordHash = await bcrypt.hash(overrides.password || 'testpass123', 4)
  return prisma.user.create({
    data: {
      email,
      name: overrides.name || '測試家長',
      passwordHash,
      role: overrides.role || 'PARENT',
    },
  })
}

/** 建立測試孩子（可選綁定到家長） */
export async function createTestChild(overrides: {
  nickname?: string
  gradeLevel?: string
  parentId?: string | null
  mode?: 'STANDARD' | 'SELF_STUDY'
} = {}) {
  return prisma.childProfile.create({
    data: {
      email: `child_${Date.now()}@test.local`,
      nickname: overrides.nickname || '測試孩子',
      gradeLevel: overrides.gradeLevel || 'G1',
      parentId: overrides.parentId ?? undefined,
      mode: overrides.mode || 'STANDARD',
    },
  })
}

/** 建立測試技能 + 題目模板 */
export async function createTestSkill(overrides: {
  code?: string
  name?: string
  gradeLevel?: string
} = {}) {
  const code = overrides.code || `test_skill_${Date.now()}`
  return prisma.skill.create({
    data: {
      code,
      name: overrides.name || '測試技能',
      gradeLevel: overrides.gradeLevel || 'G1',
      order: 0,
    },
  })
}

/** 建立測試題目（直接題） */
export async function createTestQuestion(skillId: string, overrides: {
  prompt?: string
  answer?: string
  isChallenge?: boolean
  explanation?: string
  hint?: string
} = {}) {
  return prisma.questionTemplate.create({
    data: {
      skillId,
      type: 'DIRECT',
      prompt: overrides.prompt || '1 + 1 = ?',
      answer: overrides.answer || '2',
      isChallenge: overrides.isChallenge || false,
      explanation: overrides.explanation || null,
      hint: overrides.hint || null,
    },
  })
}

/** 建立測試練習 session */
export async function createTestSession(overrides: {
  childId: string
  skillId: string
  parentId?: string | null
  status?: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ABANDONED'
  kind?: 'NORMAL' | 'PROMOTION' | 'CHALLENGE'
  totalQuestions?: number
  questionsJson?: string
}) {
  return prisma.practiceSession.create({
    data: {
      childId: overrides.childId,
      skillId: overrides.skillId,
      parentId: overrides.parentId ?? null,
      status: overrides.status || 'IN_PROGRESS',
      kind: overrides.kind || 'NORMAL',
      totalQuestions: overrides.totalQuestions || 5,
      questionsJson: overrides.questionsJson || JSON.stringify([
        { templateId: 'test', prompt: '1+1=?', answer: '2' },
      ]),
    },
  })
}

/** 建立測試作答 */
export async function createTestAttempt(overrides: {
  sessionId: string
  questionIndex?: number
  isCorrect?: boolean
  assisted?: boolean
  questionId?: string
}) {
  const qId = overrides.questionId || 'test-q'
  return prisma.attempt.create({
    data: {
      sessionId: overrides.sessionId,
      questionId: qId,
      questionIndex: overrides.questionIndex ?? 0,
      questionPrompt: '1+1=?',
      userAnswer: overrides.isCorrect ? '2' : '3',
      correctAnswer: '2',
      isCorrect: overrides.isCorrect ?? true,
      assisted: overrides.assisted ?? false,
      durationMs: 5000,
    },
  })
}
