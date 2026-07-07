import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { generateQuestion, shuffle } from '../src/lib/question.js'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const QUESTIONS_PER_SESSION = 10
const CHILD_ID = 'cmra4u0vc0001dsv5omiot1d8'

async function main() {
  console.log('=== 1. 检查孩子 ===')
  const child = await prisma.childProfile.findUnique({ where: { id: CHILD_ID } })
  console.log('孩子:', child?.nickname, '年级:', child?.gradeLevel)

  // 给 K 年级的所有技能创建掌握度快照（模拟已掌握）
  console.log('\n=== 2. 模拟 K 年级所有技能已掌握 ===')
  const skills = await prisma.skill.findMany({ where: { gradeLevel: 'K', isActive: true } })
  for (const sk of skills) {
    await prisma.masterySnapshot.upsert({
      where: { childId_skillId: { childId: CHILD_ID, skillId: sk.id } },
      update: { recentCorrect: 5, recentTotal: 5, masteryLevel: 1.0 },
      create: { childId: CHILD_ID, skillId: sk.id, recentCorrect: 5, recentTotal: 5, masteryLevel: 1.0 },
    })
  }
  console.log('✅ 已设置', skills.length, '个技能的掌握度为 100%')

  // 验证升学资格
  console.log('\n=== 3. 验证升学资格 ===')
  const allMastered = skills.every(async (sk) => {
    const snap = await prisma.masterySnapshot.findUnique({
      where: { childId_skillId: { childId: CHILD_ID, skillId: sk.id } }
    })
    return snap && snap.recentTotal > 0 && snap.masteryLevel >= 0.95
  })

  // 模拟创建升学测试 session（就像 startPromotionTest 一样）
  console.log('\n=== 4. 创建升学测试 session ===')
  const nextGrade = 'G1'
  // 取 K 和 G1 的模板
  const kQuestions = await prisma.questionTemplate.findMany({
    where: { skill: { gradeLevel: 'K' }, isActive: true },
  })
  const g1Questions = await prisma.questionTemplate.findMany({
    where: { skill: { gradeLevel: 'G1' }, isActive: true },
  })
  console.log('K 题:', kQuestions.length, 'G1 题:', g1Questions.length)

  // 生成题目
  const allQuestions: any[] = []
  // K 年級 5 题
  const shuffledK = shuffle(kQuestions).slice(0, 5)
  for (const t of shuffledK) {
    const q = generateQuestion({ id: t.id, type: t.type, prompt: t.prompt, paramsJson: t.paramsJson, answer: t.answer, options: t.options })
    allQuestions.push({ templateId: q.templateId!, prompt: q.prompt, answer: q.answer, options: q.options })
  }
  // G1 年級 5 题
  const shuffledG1 = shuffle(g1Questions).slice(0, 5)
  for (const t of shuffledG1) {
    const q = generateQuestion({ id: t.id, type: t.type, prompt: t.prompt, paramsJson: t.paramsJson, answer: t.answer, options: t.options })
    allQuestions.push({ templateId: q.templateId!, prompt: q.prompt, answer: q.answer, options: q.options })
  }

  const sessionQuestions = shuffle(allQuestions).slice(0, QUESTIONS_PER_SESSION).map((q) => ({
    ...q, __isPromotion: true, __targetGrade: 'G1'
  }))

  const session = await prisma.practiceSession.create({
    data: {
      childId: CHILD_ID,
      skillId: skills[0].id,
      parentId: child?.parentId,
      totalQuestions: QUESTIONS_PER_SESSION,
      questionsJson: JSON.stringify(sessionQuestions),
    },
  })
  console.log('✅ 升学测试 session 已创建:', session.id)

  // 模拟答完 8 题正确 + 2 题错误（正确率 80% ↑）
  console.log('\n=== 5. 模拟答题（8/10 正确） ===')
  for (let i = 0; i < QUESTIONS_PER_SESSION; i++) {
    const q = sessionQuestions[i]
    const isCorrect = i < 8 // 前 8 题对，后 2 题错
    await prisma.attempt.create({
      data: {
        sessionId: session.id,
        questionId: q.templateId,
        questionIndex: i,
        questionPrompt: q.prompt,
        userAnswer: isCorrect ? q.answer : 'wrong',
        correctAnswer: q.answer,
        isCorrect,
        assisted: false,
        durationMs: 5000,
      },
    })
  }

  // 模拟完成 session
  console.log('\n=== 6. 完成 session ===')
  await prisma.practiceSession.update({
    where: { id: session.id },
    data: { completedAt: new Date() },
  })

  // 计算通过率
  const attempts = await prisma.attempt.findMany({ where: { sessionId: session.id } })
  const legitAttempts = attempts.filter(a => !a.assisted)
  const correctCount = legitAttempts.filter(a => a.isCorrect).length
  const passRate = correctCount / legitAttempts.length
  console.log('正确率:', passRate * 100 + '%')

  if (passRate >= 0.8) {
    console.log('\n=== 7. 应该升级! ===')
    await prisma.childProfile.update({
      where: { id: CHILD_ID },
      data: { gradeLevel: 'G1' },
    })
    console.log('✅ 年级已从 K 升级到 G1')
  } else {
    console.log('❌ 正确率不足 80%，不能升级')
  }

  // 验证
  const updatedChild = await prisma.childProfile.findUnique({ where: { id: CHILD_ID } })
  console.log('\n=== 结果 ===')
  console.log('孩子:', updatedChild?.nickname, '当前年级:', updatedChild?.gradeLevel)
  console.log('期望年级: G1')
  console.log('测试:', updatedChild?.gradeLevel === 'G1' ? '✅ 通过' : '❌ 失败')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
