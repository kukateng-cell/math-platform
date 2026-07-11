// 測試斷點續做：建立一個家長+孩子，開一個練習 session，答 3 題後「中斷」（不完成）
// 執行後可用 demo 家長帳號登入驗證繼續練習功能
import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import { generateQuestion, shuffle } from '../src/lib/question.ts'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const QUESTIONS_PER_SESSION = 10

async function main() {
  console.log('🌱 建立測試斷點續做資料...')

  // 建立測試家長
  const passHash = await bcrypt.hash('demo1234', 10)
  const parent = await prisma.user.upsert({
    where: { email: 'parent@demo.test' },
    update: { passwordHash: passHash },
    create: {
      email: 'parent@demo.test',
      name: '測試家長',
      passwordHash: passHash,
      role: 'PARENT',
    },
  })
  console.log(`  ✓ 家長: ${parent.email} / demo1234`)

  // 建立測試孩子（家長建檔模式）
  const child = await prisma.childProfile.upsert({
    where: { email: 'child@demo.test' },
    update: {},
    create: {
      email: 'child@demo.test',
      nickname: '小測',
      gradeLevel: 'K',
      parentId: parent.id,
      mode: 'STANDARD',
    },
  })
  await prisma.parentChild.upsert({
    where: { parentId_childId: { parentId: parent.id, childId: child.id } },
    update: {},
    create: { parentId: parent.id, childId: child.id },
  })
  console.log(`  ✓ 孩子: ${child.nickname} (PIN: 1234)`)

  // 找一個 K 年級有題目的技能
  const skill = await prisma.skill.findFirst({
    where: { gradeLevel: 'K', isActive: true },
    include: { questions: { where: { isActive: true } } },
  })
  if (!skill || skill.questions.length === 0) {
    throw new Error('找不到 K 年級有題目的技能，請先執行 npm run db:seed')
  }
  console.log(`  ✓ 技能: ${skill.name}`)

  // 產生題目快照
  const templates = shuffle(skill.questions)
  const generated = []
  for (let i = 0; i < QUESTIONS_PER_SESSION; i++) {
    const t = templates[i % templates.length]
    const q = generateQuestion({
      id: t.id, type: t.type, prompt: t.prompt,
      paramsJson: t.paramsJson, answer: t.answer, options: t.options,
    })
    generated.push({ templateId: q.templateId!, prompt: q.prompt, answer: q.answer, options: q.options })
  }

  // 建立一個「未完成」的練習 session
  const session = await prisma.practiceSession.create({
    data: {
      childId: child.id,
      skillId: skill.id,
      parentId: parent.id,
      totalQuestions: QUESTIONS_PER_SESSION,
      questionsJson: JSON.stringify(generated),
      // completedAt 不設 → 未完成
    },
  })
  console.log(`  ✓ 未完成練習 session: ${session.id}`)

  // 答前 3 題（建立 attempt，含 questionIndex）
  for (let i = 0; i < 3; i++) {
    const q = generated[i]
    const userAnswer = i === 0 ? q.answer : '0' // 第1題答對，後2題亂答
    await prisma.attempt.create({
      data: {
        sessionId: session.id,
        questionId: q.templateId,
        questionIndex: i,
        questionPrompt: q.prompt,
        userAnswer,
        correctAnswer: q.answer,
        isCorrect: userAnswer === q.answer,
        assisted: false,
        durationMs: 5000 + i * 1000,
      },
    })
  }
  console.log(`  ✓ 已答 3 題（session 應顯示「剩 7 題」）`)

  console.log('\n═══════════════════════════════════════════')
  console.log('測試方式：')
  console.log('1. 用 parent@demo.test / demo1234 登入')
  console.log(`2. 進入孩子「小測」的練習選單 → 應看到綠色「繼續上次練習」卡片（剩 7 題）`)
  console.log(`3. 點「繼續」→ 應從第 4 題開始（不是第 1 題）`)
  console.log('═══════════════════════════════════════════\n')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
