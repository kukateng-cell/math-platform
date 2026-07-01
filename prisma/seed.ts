import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import path from 'node:path'
import bcrypt from 'bcryptjs'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding...')

  // ============ 管理員帳號 ============
  const adminHash = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@math.local' },
    update: {},
    create: {
      email: 'admin@math.local',
      name: '管理員',
      passwordHash: adminHash,
      role: 'ADMIN',
    },
  })
  console.log(`  ✓ Admin: ${admin.email} / admin123`)

  // ============ 技能（K-2 數感與計算）============
  const countCompare = await prisma.skill.upsert({
    where: { code: 'count-compare' },
    update: {},
    create: {
      code: 'count-compare',
      name: '數量比較',
      description: '比較兩組物品或兩個數的大小',
      gradeLevel: 'K',
      order: 1,
    },
  })

  const addWithin10 = await prisma.skill.upsert({
    where: { code: 'add-within-10' },
    update: {},
    create: {
      code: 'add-within-10',
      name: '10 以內加法',
      description: '兩數相加，和不超過 10',
      gradeLevel: 'G1',
      order: 2,
      prerequisiteId: countCompare.id,
    },
  })

  const subWithin10 = await prisma.skill.upsert({
    where: { code: 'sub-within-10' },
    update: {},
    create: {
      code: 'sub-within-10',
      name: '10 以內減法',
      description: '兩數相減，差不為負',
      gradeLevel: 'G1',
      order: 3,
      prerequisiteId: addWithin10.id,
    },
  })

  const wordProblem = await prisma.skill.upsert({
    where: { code: 'word-problem' },
    update: {},
    create: {
      code: 'word-problem',
      name: '簡單文字題',
      description: '生活情境的加減應用',
      gradeLevel: 'G2',
      order: 4,
      prerequisiteId: subWithin10.id,
    },
  })

  // ============ 題目模板 ============
  // 清除舊題目再重灌（避免 idempotency 衝突）
  await prisma.questionTemplate.deleteMany({})

  // 數量比較：直接題目
  const compareQuestions = [
    { prompt: '哪一個比較多？', answer: '8', options: '3,8' },
    { prompt: '哪一個比較大？', answer: '7', options: '7,4' },
    { prompt: '哪一個比較少？', answer: '2', options: '5,2' },
    { prompt: '哪一個比較小？', answer: '6', options: '9,6' },
    { prompt: '哪一個比較多？', answer: '10', options: '10,1' },
  ]
  for (const q of compareQuestions) {
    await prisma.questionTemplate.create({
      data: {
        skillId: countCompare.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        options: q.options,
        explanation: '比較兩個數字的大小',
      },
    })
  }

  // 加法：參數化模板（a + b, 和 ≤ 10）
  await prisma.questionTemplate.create({
    data: {
      skillId: addWithin10.id,
      type: 'ADD',
      prompt: '{a} + {b} = ?',
      paramsJson: JSON.stringify({ aMin: 1, aMax: 5, bMin: 1, bMax: 5, sumMax: 10 }),
      answer: '{a+b}',
      explanation: '把兩個數合起來',
    },
  })
  // 加一些直接題目確保數量充足
  const addDirect = [
    { prompt: '3 + 4 = ?', answer: '7' },
    { prompt: '2 + 5 = ?', answer: '7' },
    { prompt: '1 + 8 = ?', answer: '9' },
    { prompt: '6 + 3 = ?', answer: '9' },
    { prompt: '4 + 4 = ?', answer: '8' },
  ]
  for (const q of addDirect) {
    await prisma.questionTemplate.create({
      data: { skillId: addWithin10.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer },
    })
  }

  // 減法：參數化模板（a - b, 差 ≥ 0）
  await prisma.questionTemplate.create({
    data: {
      skillId: subWithin10.id,
      type: 'SUB',
      prompt: '{a} - {b} = ?',
      paramsJson: JSON.stringify({ aMin: 3, aMax: 10, bMin: 1, bMax: 5 }),
      answer: '{a-b}',
      explanation: '從大數裡拿走小數',
    },
  })
  const subDirect = [
    { prompt: '8 - 3 = ?', answer: '5' },
    { prompt: '10 - 4 = ?', answer: '6' },
    { prompt: '7 - 2 = ?', answer: '5' },
    { prompt: '9 - 5 = ?', answer: '4' },
    { prompt: '6 - 6 = ?', answer: '0' },
  ]
  for (const q of subDirect) {
    await prisma.questionTemplate.create({
      data: { skillId: subWithin10.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer },
    })
  }

  // 文字題：直接題目
  const wordQuestions = [
    { prompt: '桌上有 3 顆蘋果，又放了 4 顆，現在有幾顆？', answer: '7' },
    { prompt: '有 10 顆糖果，吃掉 3 顆，還剩幾顆？', answer: '7' },
    { prompt: '鉛筆盒裡有 5 枝筆，再放進 2 枝，共有幾枝？', answer: '7' },
    { prompt: '有 8 顆氣球，飛走 2 顆，還剩幾顆？', answer: '6' },
    { prompt: '花園裡有 4 朵花，又開了 5 朵，現在有幾朵？', answer: '9' },
  ]
  for (const q of wordQuestions) {
    await prisma.questionTemplate.create({
      data: {
        skillId: wordProblem.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: '把題目裡的數量列出來，判斷是加還是減',
      },
    })
  }

  console.log('  ✓ Skills: 4, Questions seeded')
  console.log('✅ Done!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
