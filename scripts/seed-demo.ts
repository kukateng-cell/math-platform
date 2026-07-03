// ============================================================================
// 演示資料產生器 (Demo Data Seeder)
// 建立「假的」家長帳號、孩子檔案，以及完整的練習歷史（session/attempt/mastery）
// 與遊戲化資料（星星 / streak / 徽章），讓網站看起來有真實的使用者活動。
//
// 執行：npm run db:seed:demo
//
// 特性：
// - 冪等：先刪除標記為 demo 的舊資料（email 含 @demo.com），再重建
// - 一致：題目快照使用與正式 app 相同的 generateQuestion，掌握度/星星依
//   app 真實公式計算，不會出現對不上的數字
// ============================================================================

import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import { generateQuestion, shuffle } from '../src/lib/question.ts'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const QUESTIONS_PER_SESSION = 10
const RECENT_WINDOW = 5 // 與 src/lib/mastery.ts 一致

// ============ session 題目快照格式（與 src/actions/practice.ts 一致）============
type StoredQuestion = {
  templateId: string
  prompt: string
  answer: string
  options?: string[]
  explanation?: string
  interaction?: string
  rangeMin?: number
  rangeMax?: number
}

// ============ 工具函式 ============
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)]
}

// 從一個技能的題庫產生一次練習的題目快照（與 startSession 邏輯一致）
function buildSessionQuestions(
  templates: {
    id: string
    type: string
    prompt: string
    paramsJson: string | null
    answer: string
    options: string | null
    explanation: string | null
  }[]
): StoredQuestion[] {
  const shuffled = shuffle(templates)
  const generated: StoredQuestion[] = []
  for (let i = 0; i < QUESTIONS_PER_SESSION; i++) {
    const t = shuffled[i % shuffled.length]
    const q = generateQuestion({
      id: t.id,
      type: t.type as 'DIRECT' | 'ADD' | 'SUB' | 'WORD_PROBLEM' | 'MUL' | 'DIV',
      prompt: t.prompt,
      paramsJson: t.paramsJson,
      answer: t.answer,
      options: t.options,
    })

    // 解析互動模式（從 paramsJson，與 practice.ts 一致）
    let interaction: string | undefined
    let rangeMin: number | undefined
    let rangeMax: number | undefined
    if (t.paramsJson) {
      try {
        const parsed = JSON.parse(t.paramsJson)
        interaction = parsed.interaction
        rangeMin = parsed.rangeMin
        rangeMax = parsed.rangeMax
      } catch {
        /* ignore */
      }
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
  return generated
}

// ============ 一次完整練習的產生結果 ============
type GeneratedSession = {
  questions: StoredQuestion[]
  // 每題是否答對（依孩子的正確率決定）
  correctness: boolean[]
  // 每題是否家長協助（少量機率）
  assisted: boolean[]
  correctCount: number // 不計 assisted 的正確數
  startedAt: Date
  completedAt: Date
}

// 依正確率產生一次練習的作答結果
function rollSession(
  templates: {
    id: string
    type: string
    prompt: string
    paramsJson: string | null
    answer: string
    options: string | null
    explanation: string | null
  }[],
  accuracy: number, // 0~1，這個孩子在這個技能的預期正確率
  startedAt: Date
): GeneratedSession {
  const questions = buildSessionQuestions(templates)
  const correctness: boolean[] = []
  const assisted: boolean[] = []

  for (let i = 0; i < questions.length; i++) {
    // 少量機率家長協助（約 8%），協助的題目一律算「對」但不計入正確數/星星
    const isAssisted = Math.random() < 0.08
    assisted.push(isAssisted)

    if (isAssisted) {
      correctness.push(true)
    } else {
      correctness.push(Math.random() < accuracy)
    }
  }

  const correctCount = correctness.reduce(
    (sum, ok, i) => sum + (ok && !assisted[i] ? 1 : 0),
    0
  )

  const completedAt = new Date(startedAt.getTime() + randInt(3, 12) * 60 * 1000)

  return { questions, correctness, assisted, correctCount, startedAt, completedAt }
}

// ============ 將一次練習寫入資料庫（含 attempts / correctCount）============
async function writeSession(
  childId: string,
  skillId: string,
  parentId: string | null,
  gen: GeneratedSession
): Promise<{ sessionId: string; skillAttempts: { isCorrect: boolean; assisted: boolean; createdAt: Date }[] }> {
  const session = await prisma.practiceSession.create({
    data: {
      childId,
      skillId,
      parentId,
      startedAt: gen.startedAt,
      completedAt: gen.completedAt,
      totalQuestions: QUESTIONS_PER_SESSION,
      correctCount: gen.correctCount,
      questionsJson: JSON.stringify(gen.questions),
    },
  })

  const skillAttempts: { isCorrect: boolean; assisted: boolean; createdAt: Date }[] = []

  for (let i = 0; i < gen.questions.length; i++) {
    const q = gen.questions[i]
    const isCorrect = gen.correctness[i]
    const isAssisted = gen.assisted[i]
    const attemptTime = new Date(
      gen.startedAt.getTime() + (i + 1) * randInt(8, 40) * 1000
    )
    await prisma.attempt.create({
      data: {
        sessionId: session.id,
        questionId: q.templateId,
        questionPrompt: q.prompt,
        userAnswer: isCorrect
          ? q.answer
          : wrongAnswer(q.answer, q.options),
        correctAnswer: q.answer,
        isCorrect,
        assisted: isAssisted,
        durationMs: randInt(2000, 25000),
        createdAt: attemptTime,
      },
    })
    skillAttempts.push({ isCorrect, assisted: isAssisted, createdAt: attemptTime })
  }

  return { sessionId: session.id, skillAttempts }
}

// 產生一個「錯誤但不離譜」的答案
function wrongAnswer(correct: string, options?: string[]): string {
  // 若有選項，從選項中挑一個錯的
  if (options && options.length > 1) {
    const wrong = options.filter((o) => o !== correct)
    if (wrong.length > 0) return pick(wrong)
  }
  // 否則給一個數字附近的錯誤答案
  const n = Number(correct)
  if (!Number.isNaN(n)) {
    const delta = pick([-2, -1, 1, 2, 3])
    const w = Math.max(0, n + delta)
    return String(w)
  }
  return correct
}

// 依該技能所有 attempt（非 assisted）重算掌握度快照（與 updateMastery 一致）
async function updateMasteryForSkill(childId: string, skillId: string) {
  const recent = await prisma.attempt.findMany({
    where: { session: { childId, skillId }, assisted: false },
    orderBy: { createdAt: 'desc' },
    take: RECENT_WINDOW,
  })
  const recentCorrect = recent.filter((a) => a.isCorrect).length
  const recentTotal = recent.length
  const masteryLevel = recentTotal > 0 ? recentCorrect / recentTotal : 0
  await prisma.masterySnapshot.upsert({
    where: { childId_skillId: { childId, skillId } },
    update: { recentCorrect, recentTotal, masteryLevel },
    create: { childId, skillId, recentCorrect, recentTotal, masteryLevel },
  })
}

// 計算孩子應獲得的徽章並寫入（與 checkBadges 邏輯一致）
async function awardBadges(
  childId: string,
  stars: number,
  streak: number,
  practicedSkillIds: Set<string>,
  totalSkillCount: number,
  hasPerfectSession: boolean,
  addAccuracy: number | null
) {
  const allBadges = await prisma.badge.findMany()
  for (const badge of allBadges) {
    let earned = false
    switch (badge.code) {
      case 'first-practice':
        earned = true // demo 孩子都有練習紀錄
        break
      case 'streak-7':
        earned = streak >= 7
        break
      case 'streak-14':
        earned = streak >= 14
        break
      case 'streak-30':
        earned = streak >= 30
        break
      case 'stars-50':
        earned = stars >= 50
        break
      case 'stars-100':
        earned = stars >= 100
        break
      case 'perfect-score':
        earned = hasPerfectSession
        break
      case 'all-skills':
        earned = practicedSkillIds.size >= totalSkillCount
        break
      case 'addition-master':
        earned = addAccuracy !== null && addAccuracy >= 0.9
        break
    }
    if (earned) {
      await prisma.childBadge.upsert({
        where: { childId_badgeId: { childId, badgeId: badge.id } },
        update: {},
        create: { childId, badgeId: badge.id },
      })
    }
  }
}

// ============================================================================
// 主流程
// ============================================================================
async function main() {
  console.log('🎭 開始產生演示資料...')

  // ---------- 0. 取得技能與題庫 ----------
  const skills = await prisma.skill.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
    include: { questions: { where: { isActive: true } } },
  })
  if (skills.length === 0) {
    throw new Error('資料庫沒有技能資料，請先執行 npm run db:seed 建立基礎題庫')
  }
  // 技能代碼 → 資料的查詢表
  const skillByCode = new Map(skills.map((s) => [s.code, s]))

  // ---------- 1. 清除舊的 demo 資料（冪等）----------
  console.log('🧹 清除舊的 demo 資料...')
  // 先找出 demo 帳號的 id
  const demoUsers = await prisma.user.findMany({
    where: { email: { contains: '@demo.com' } },
    select: { id: true },
  })
  const demoChildren = await prisma.childProfile.findMany({
    where: { email: { contains: '@demo.com' } },
    select: { id: true },
  })
  const demoUserIds = demoUsers.map((u) => u.id)
  const demoChildIds = demoChildren.map((c) => c.id)

  if (demoChildIds.length > 0) {
    // ChildProfile 的 cascade 會清掉 sessions/attempts/mastery/badges
    await prisma.childProfile.deleteMany({ where: { id: { in: demoChildIds } } })
  }
  if (demoUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: demoUserIds } } })
  }
  console.log(`   已清除 ${demoUsers.length} 個 demo 家長、${demoChildren.length} 個 demo 孩子`)

  // ---------- 2. 建立家長帳號 ----------
  const passwordHash = await bcrypt.hash('demo1234', 10)
  const parents = [
    { name: '王雅婷', email: 'parent.wang@demo.com' },
    { name: '李大偉', email: 'parent.li@demo.com' },
    { name: '陳美玲', email: 'parent.chen@demo.com' },
  ]
  const parentIds: Record<string, string> = {}
  for (const p of parents) {
    const user = await prisma.user.create({
      data: { email: p.email, name: p.name, passwordHash, role: 'PARENT' },
    })
    parentIds[p.name] = user.id
    console.log(`   ✓ 家長：${p.name} (${p.email}) / demo1234`)
  }

  // ---------- 3. 孩子設定檔 ----------
  // accuracy：這個孩子在「已學技能」上的平均正確率；學新技能時會稍降
  // streakDays / starsBase：直接設定起始遊戲化數值
  type ChildSpec = {
    nickname: string
    grade: 'K' | 'G1' | 'G2'
    parentName: string
    accuracy: number
    streak: number
    skillCodes: string[] // 這個孩子練習過 / 應練習的技能
    sessionsPerSkill: number
    pin?: string
    // SELF_STUDY 自主學習學生
    selfStudy?: { email: string; linkParentName?: string }
  }

  const children: ChildSpec[] = [
    {
      nickname: '王小明',
      grade: 'G1',
      parentName: '王雅婷',
      accuracy: 0.72,
      streak: 5,
      pin: '1234',
      skillCodes: ['count-objects', 'shape-recognition', 'count-compare', 'add-within-10', 'sub-within-10'],
      sessionsPerSkill: 3,
    },
    {
      nickname: '王心怡',
      grade: 'K',
      parentName: '王雅婷',
      accuracy: 0.58,
      streak: 2,
      pin: '5678',
      skillCodes: ['count-objects', 'shape-recognition'],
      sessionsPerSkill: 2,
    },
    {
      nickname: '李承恩',
      grade: 'G2',
      parentName: '李大偉',
      accuracy: 0.88,
      streak: 14,
      pin: '1111',
      skillCodes: [
        'count-compare', 'add-within-10', 'sub-within-10', 'add-within-20',
        'word-problem', 'intro-multiply', 'multiply-6-9', 'multiply-table', 'intro-divide',
      ],
      sessionsPerSkill: 3,
    },
    {
      nickname: '李詩涵',
      grade: 'G1',
      parentName: '李大偉',
      accuracy: 0.65,
      streak: 3,
      pin: '2222',
      skillCodes: ['count-objects', 'count-compare', 'add-within-10', 'sub-within-10', 'add-within-20'],
      sessionsPerSkill: 2,
    },
    {
      nickname: '陳品睿',
      grade: 'G2',
      parentName: '陳美玲',
      accuracy: 0.93,
      streak: 9,
      pin: '3333',
      skillCodes: [
        'add-within-10', 'sub-within-10', 'add-within-20', 'word-problem',
        'intro-multiply', 'multiply-6-9', 'multiply-table', 'intro-divide', 'divide-basic',
      ],
      sessionsPerSkill: 3,
    },
    {
      nickname: '周子瑜',
      grade: 'G1',
      parentName: '陳美玲',
      accuracy: 0.7,
      streak: 4,
      skillCodes: ['count-objects', 'shape-recognition', 'count-compare', 'add-within-10'],
      sessionsPerSkill: 2,
      selfStudy: { email: 'student.zhou@demo.com', linkParentName: '陳美玲' },
    },
  ]

  const totalSkillCount = skills.length
  let totalStars = 0
  let totalSessions = 0
  let totalAttempts = 0

  for (const spec of children) {
    // ----- 建立孩子檔案 -----
    const parentId = parentIds[spec.parentName]
    const child = await prisma.childProfile.create({
      data: {
        nickname: spec.nickname,
        gradeLevel: spec.grade,
        parentId,
        mode: spec.selfStudy ? 'SELF_STUDY' : 'STANDARD',
        email: spec.selfStudy?.email,
        passwordHash: spec.selfStudy ? passwordHash : undefined,
        pin: spec.pin,
        // 遊戲化數值稍後依實際練習累加，這裡先歸零
        stars: 0,
        streak: 0,
        lastPracticeAt: null,
      },
    })

    // SELF_STUDY 學生綁定家長（透過 ParentChild）
    if (spec.selfStudy?.linkParentName) {
      const linkParentId = parentIds[spec.selfStudy.linkParentName]
      if (linkParentId) {
        await prisma.parentChild.create({
          data: { parentId: linkParentId, childId: child.id },
        })
      }
    }

    // ----- 產生練習歷史 -----
    // 將 session 分散在過去 N 天（配合 streak），最近一天設定為今天或昨天
    const practicedSkillIds = new Set<string>()
    let childStars = 0
    let hasPerfectSession = false
    // 收集加法相關 attempt 以算 addition-master 徽章
    let addCorrect = 0
    let addTotal = 0
    // 該孩子所有 session 的時間軸（用來分布日期）
    const allSkillSessions: { skillId: string; templates: any[]; dayOffset: number; accuracy: number }[] = []

    // 為了讓 streak 合理，練習分布在最近 spec.streak 天 + 之前的零星天數
    for (const code of spec.skillCodes) {
      const skill = skillByCode.get(code)
      if (!skill || skill.questions.length === 0) continue
      const templates = skill.questions.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        paramsJson: q.paramsJson,
        answer: q.answer,
        options: q.options,
        explanation: q.explanation,
      }))
      for (let s = 0; s < spec.sessionsPerSkill; s++) {
        // 學新技能時正確率略降（前 1~2 次較不熟）
        const sessionAccuracy = Math.max(
          0.3,
          spec.accuracy - (s === 0 ? 0.12 : s === 1 ? 0.05 : 0)
        )
        // 日期：越後面的 session 越接近今天；用負偏移讓最早在前
        // 全部 session 平均分布在天數範圍
        allSkillSessions.push({
          skillId: skill.id,
          templates,
          dayOffset: 0, // 之後重排
          accuracy: sessionAccuracy,
        })
      }
      practicedSkillIds.add(skill.id)
      if (code === 'add-within-10' || code === 'add-within-20') {
        // 標記稍後累計加法正確率
      }
    }

    // 排序 session：依技能順序（先學的技能 session 較早），同技能內由舊到新
    // 指派日期：從 (今天 - (總天數範圍)) 往今天推進
    const sessionCount = allSkillSessions.length
    // 分布的天數跨度：至少 max(streak, session數) 天，讓連續天數合理
    const daySpan = Math.max(spec.streak, Math.ceil(sessionCount / 1.5))
    for (let i = 0; i < sessionCount; i++) {
      // 由舊到新：第 i 個 session 大約在 daySpan-i 天前（最近幾天密集）
      // 讓最後幾個 session 落在最近 streak 天，形成連續
      const baseOffset = daySpan - i // 0 = 最舊 ... daySpan = 最新
      allSkillSessions[i].dayOffset = baseOffset
    }

    // 寫入每個 session
    for (const ss of allSkillSessions) {
      const startedAt = new Date()
      startedAt.setDate(startedAt.getDate() - ss.dayOffset)
      startedAt.setHours(19, randInt(0, 59), 0, 0) // 晚上 7 點左右練習
      const gen = rollSession(ss.templates, ss.accuracy, startedAt)
      const { skillAttempts } = await writeSession(
        child.id,
        ss.skillId,
        parentId,
        gen
      )
      totalSessions++
      totalAttempts += skillAttempts.length
      childStars += gen.correctCount

      // 完美得分？
      const nonAssisted = skillAttempts.filter((a) => !a.assisted)
      if (nonAssisted.length > 0 && nonAssisted.every((a) => a.isCorrect)) {
        hasPerfectSession = true
      }

      // 累計加法正確率（取最近 20 題）
      const skill = skills.find((sk) => sk.id === ss.skillId)
      if (skill && (skill.code === 'add-within-10' || skill.code === 'add-within-20')) {
        for (const a of skillAttempts) {
          if (!a.assisted) {
            addTotal++
            if (a.isCorrect) addCorrect++
          }
        }
      }
    }

    // ----- 重算每個練習過技能的掌握度快照 -----
    for (const skillId of practicedSkillIds) {
      await updateMasteryForSkill(child.id, skillId)
    }

    // ----- 設定遊戲化數值 -----
    // stars = 累計星星（不計 assisted 的正確數），與 updateStars 一致
    // streak = spec.streak；lastPracticeAt 設為今天（若 dayOffset 有 0 的話）或最近練習日
    const lastPracticeAt = new Date()
    lastPracticeAt.setDate(lastPracticeAt.getDate() - 1) // 昨天最後練習
    lastPracticeAt.setHours(20, 0, 0, 0)
    await prisma.childProfile.update({
      where: { id: child.id },
      data: {
        stars: childStars,
        streak: spec.streak,
        lastPracticeAt,
      },
    })
    totalStars += childStars

    // ----- 頒發徽章 -----
    const addAccuracy = addTotal > 0 ? addCorrect / addTotal : null
    await awardBadges(
      child.id,
      childStars,
      spec.streak,
      practicedSkillIds,
      totalSkillCount,
      hasPerfectSession,
      addAccuracy
    )

    console.log(
      `   ✓ 孩子：${spec.nickname} (${spec.grade}) ` +
        `— ${allSkillSessions.length} 次練習、⭐${childStars}、🔥${spec.streak}` +
        `${spec.selfStudy ? ' [自主學習]' : ''}`
    )
  }

  // ---------- 總結 ----------
  console.log('')
  console.log('════════════════════════════════════════')
  console.log('✅ 演示資料建立完成！')
  console.log('────────────────────────────────────────')
  console.log(`  家長帳號：${parents.length} 個（密碼均為 demo1234）`)
  console.log(`  孩子檔案：${children.length} 個`)
  console.log(`  練習次數：${totalSessions} 次`)
  console.log(`  作答紀錄：${totalAttempts} 題`)
  console.log(`  累計星星：${totalStars} 顆`)
  console.log('────────────────────────────────────────')
  console.log('  登入測試帳號：')
  parents.forEach((p) => {
    console.log(`    家長 → ${p.email} / demo1234`)
  })
  console.log(`    自主學習學生 → student.zhou@demo.com / demo1234`)
  console.log('════════════════════════════════════════')
}

main()
  .catch((e) => {
    console.error('❌ 演示資料建立失敗：', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
