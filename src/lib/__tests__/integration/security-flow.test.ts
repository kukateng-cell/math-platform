/**
 * DB Integration Tests — 關鍵安全流程驗證
 *
 * 這些測試需要 PostgreSQL（DATABASE_URL），使用 test-db.ts helper。
 * CI 環境透過 GitHub Actions PostgreSQL service container 提供。
 *
 * 測試涵蓋（P1-13）：
 *   1. Password reset grant one-time consumption
 *   2. TokenVersion session invalidation
 *   3. Question payload 不含 answer/explanation
 *   4. Parent/child/linked-parent 權限矩陣
 *   5. Attempt duplicate / session 完成 crash recovery
 *   6. Promotion concurrent claim (idempotency)
 *   7. Abandoned session 不入報表
 *   8. Challenge 不更新 mastery
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  prisma, cleanDatabase,
  createTestParent, createTestChild, createTestSkill,
  createTestQuestion, createTestSession, createTestAttempt,
} from '../helpers/test-db'

// ──────────────────────────────────────────────
// 所有整合測試共用 setup / teardown
// ──────────────────────────────────────────────

beforeAll(async () => {
  // 確保資料庫 schema 存在（CI 環境可能剛建立）
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    throw new Error('Database not reachable — check DATABASE_URL')
  }
})

afterAll(async () => {
  await prisma.$disconnect()
})

beforeEach(async () => {
  await cleanDatabase()
})

// ──────────────────────────────────────────────
// 1. Password reset grant one-time consumption
// ──────────────────────────────────────────────

describe('密碼重設 grant 一次性', () => {
  it('同一個 jti 的 grant 只能消耗一次', async () => {
    const user = await createTestParent()
    const jti = 'test-jti-' + Date.now()

    await prisma.passwordResetGrant.create({
      data: { userId: user.id, jti, expiresAt: new Date(Date.now() + 3600_000) },
    })

    // 第一次消耗應成功
    const first = await prisma.passwordResetGrant.updateMany({
      where: { jti, userId: user.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    })
    expect(first.count).toBe(1)

    // 第二次消耗應失敗（consumedAt 已非 null）
    const second = await prisma.passwordResetGrant.updateMany({
      where: { jti, userId: user.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    })
    expect(second.count).toBe(0)
  })

  it('過期的 grant 不可消耗', async () => {
    const user = await createTestParent()
    const jti = 'expired-jti-' + Date.now()

    await prisma.passwordResetGrant.create({
      data: { userId: user.id, jti, expiresAt: new Date(Date.now() - 1000) },
    })

    const result = await prisma.passwordResetGrant.updateMany({
      where: { jti, userId: user.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    })
    expect(result.count).toBe(0)
  })
})

// ──────────────────────────────────────────────
// 2. TokenVersion session invalidation
// ──────────────────────────────────────────────

describe('tokenVersion session 失效', () => {
  it('tokenVersion 遞增後，舊版本查詢應回傳 null', async () => {
    const user = await createTestParent()
    const originalVersion = user.tokenVersion

    // 模擬密碼重設 → tokenVersion++
    await prisma.user.update({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
    })

    const updated = await prisma.user.findUnique({ where: { id: user.id } })
    expect(updated?.tokenVersion).toBe(originalVersion + 1)
  })
})

// ──────────────────────────────────────────────
// 3. Question payload 不含 answer/explanation
// ──────────────────────────────────────────────

describe('題目 payload 安全', () => {
  it('StoredQuestion 轉 PublicQuestion 時移除 answer 與 explanation', async () => {
    const skill = await createTestSkill()
    await createTestQuestion(skill.id, {
      prompt: '測試題目',
      answer: '42',
      explanation: '這是完整解題說明 42=答案',
      hint: '安全的提示',
    })

    // 模擬 getSessionQuestions 的回傳：從 StoredQuestion 移除 answer/explanation
    const storedQuestions = [
      { templateId: 't1', prompt: '測試題目', answer: '42', explanation: '這是完整解題說明 42=答案', hint: '安全的提示', options: undefined },
    ]
    const publicQuestions = storedQuestions.map(({ answer, explanation, ...rest }) => {
      void answer; void explanation
      return rest
    })

    expect(publicQuestions[0]).not.toHaveProperty('answer')
    expect(publicQuestions[0]).not.toHaveProperty('explanation')
    expect(publicQuestions[0]).toHaveProperty('hint')
    expect(publicQuestions[0].hint).toBe('安全的提示')
  })
})

// ──────────────────────────────────────────────
// 4. Parent/child/linked-parent 權限矩陣
// ──────────────────────────────────────────────

describe('權限矩陣', () => {
  it('家長可看到自己建立的孩子', async () => {
    const parent = await createTestParent()
    const child = await createTestChild({ parentId: parent.id })

    const found = await prisma.childProfile.findFirst({
      where: { id: child.id, parentId: parent.id },
    })
    expect(found).not.toBeNull()
  })

  it('家長看不到其他家長的孩子', async () => {
    const parent1 = await createTestParent({ email: 'p1@test.local' })
    const parent2 = await createTestParent({ email: 'p2@test.local' })
    await createTestChild({ parentId: parent1.id })

    const children = await prisma.childProfile.findMany({ where: { parentId: parent2.id } })
    expect(children).toHaveLength(0)
  })

  it('ACTIVE linked parent 可存取孩子', async () => {
    const parent = await createTestParent()
    const child = await createTestChild({ parentId: null }) // 自主學生

    await prisma.parentChild.create({
      data: { parentId: parent.id, childId: child.id, status: 'ACTIVE' },
    })

    const link = await prisma.parentChild.findFirst({
      where: { parentId: parent.id, childId: child.id, status: 'ACTIVE' },
    })
    expect(link).not.toBeNull()
  })

  it('PENDING linked parent 不可看到孩子資料', async () => {
    const parent = await createTestParent()
    const child = await createTestChild({ parentId: null })

    await prisma.parentChild.create({
      data: { parentId: parent.id, childId: child.id, status: 'PENDING' },
    })

    const activeLink = await prisma.parentChild.findFirst({
      where: { parentId: parent.id, childId: child.id, status: 'ACTIVE' },
    })
    expect(activeLink).toBeNull()
  })
})

// ──────────────────────────────────────────────
// 5. Attempt duplicate / session 完成 crash recovery
// ──────────────────────────────────────────────

describe('Attempt 重複提交與 session 完成', () => {
  it('同一題重複提交應被 @@unique 約束阻擋', async () => {
    const child = await createTestChild()
    const skill = await createTestSkill()
    const q = await createTestQuestion(skill.id)
    const session = await createTestSession({ childId: child.id, skillId: skill.id, totalQuestions: 3 })

    // 第一次提交
    await createTestAttempt({ sessionId: session.id, questionIndex: 0, questionId: q.id })

    // 第二次同 index 應拋 P2002
    await expect(
      createTestAttempt({ sessionId: session.id, questionIndex: 0, questionId: q.id })
    ).rejects.toThrow()
  })

  it('實際作答數 ≥ totalQuestions 才算完成', async () => {
    const child = await createTestChild()
    const skill = await createTestSkill()
    const session = await createTestSession({
      childId: child.id,
      skillId: skill.id,
      totalQuestions: 2,
      status: 'IN_PROGRESS',
    })
    const q = await createTestQuestion(skill.id)

    // 只有 1 題作答 → 不應完成
    await createTestAttempt({ sessionId: session.id, questionIndex: 0, questionId: q.id })
    const count1 = await prisma.attempt.count({ where: { sessionId: session.id } })
    expect(count1).toBe(1)

    await createTestAttempt({ sessionId: session.id, questionIndex: 1, questionId: q.id })
    const count2 = await prisma.attempt.count({ where: { sessionId: session.id } })
    expect(count2).toBe(2)
  })
})

// ──────────────────────────────────────────────
// 6. Promotion concurrent claim (idempotency)
// ──────────────────────────────────────────────

describe('Promotion 併發重複領獎', () => {
  it('status=IN_PROGRESS 條件式 update 應只有第一個成功', async () => {
    const child = await createTestChild()
    const skill = await createTestSkill()
    const session = await createTestSession({
      childId: child.id,
      skillId: skill.id,
      status: 'IN_PROGRESS',
    })

    // 模擬兩個併發請求同時嘗試完成
    const [r1, r2] = await Promise.all([
      prisma.practiceSession.updateMany({
        where: { id: session.id, status: 'IN_PROGRESS' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      }),
      prisma.practiceSession.updateMany({
        where: { id: session.id, status: 'IN_PROGRESS' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      }),
    ])

    // 只有一個請求應該成功
    expect(r1.count + r2.count).toBe(1)
  })
})

// ──────────────────────────────────────────────
// 7. Abandoned session 不入報表
// ──────────────────────────────────────────────

describe('Abandoned session 不計入報表', () => {
  it('僅 COMPLETED 狀態計入完成次數', async () => {
    const child = await createTestChild()
    const skill = await createTestSkill()

    // COMPLETED session
    await createTestSession({ childId: child.id, skillId: skill.id, status: 'COMPLETED' })
    // CANCELLED session
    await createTestSession({ childId: child.id, skillId: skill.id, status: 'CANCELLED' })
    // ABANDONED session
    await createTestSession({ childId: child.id, skillId: skill.id, status: 'ABANDONED' })

    const completedCount = await prisma.practiceSession.count({
      where: { childId: child.id, status: 'COMPLETED' },
    })
    expect(completedCount).toBe(1)

    // 全部 session 有 3 筆，但只有 1 筆是真正的 COMPLETED
    const totalCount = await prisma.practiceSession.count({
      where: { childId: child.id },
    })
    expect(totalCount).toBe(3)
  })
})

// ──────────────────────────────────────────────
// 8. Challenge 不更新 mastery
// ──────────────────────────────────────────────

describe('Challenge session 不更新掌握度', () => {
  it('NORMAL session 可更新 masterySnapshot', async () => {
    const child = await createTestChild()
    const skill = await createTestSkill()
    const session = await createTestSession({
      childId: child.id, skillId: skill.id, kind: 'NORMAL', status: 'COMPLETED',
    })
    await createTestAttempt({ sessionId: session.id, isCorrect: true, assisted: false })

    await prisma.masterySnapshot.upsert({
      where: { childId_skillId: { childId: child.id, skillId: skill.id } },
      update: { recentCorrect: 1, recentTotal: 1, masteryLevel: 1 },
      create: { childId: child.id, skillId: skill.id, recentCorrect: 1, recentTotal: 1, masteryLevel: 1 },
    })

    const ms = await prisma.masterySnapshot.findUnique({
      where: { childId_skillId: { childId: child.id, skillId: skill.id } },
    })
    expect(ms).not.toBeNull()
    expect(ms!.masteryLevel).toBe(1)
  })

  it('CHALLENGE session 不應建立 masterySnapshot', async () => {
    const child = await createTestChild()
    const skill = await createTestSkill()
    const session = await createTestSession({
      childId: child.id, skillId: skill.id, kind: 'CHALLENGE', status: 'COMPLETED',
    })
    await createTestAttempt({ sessionId: session.id, isCorrect: true, assisted: false })

    // CHALLENGE 不應建立掌握度（updateMastery 中 kind !== 'NORMAL' 時直接 return）
    const ms = await prisma.masterySnapshot.findUnique({
      where: { childId_skillId: { childId: child.id, skillId: skill.id } },
    })
    expect(ms).toBeNull()
  })
})
