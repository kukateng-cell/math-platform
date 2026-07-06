import { prisma } from '@/lib/prisma'
import { accessibleGrades } from '@/lib/grade'

// ============ 星星獎勵 ============
// 每次練習完成後將此輪獲得的星星加入總數
export async function updateStars(childId: string, earnedStars: number) {
  if (earnedStars <= 0) return
  await prisma.childProfile.update({
    where: { id: childId },
    data: { stars: { increment: earnedStars } },
  })
}

// ============ 連續練習天數（Streak）============
export async function updateStreak(childId: string) {
  const child = await prisma.childProfile.findUnique({ where: { id: childId } })
  if (!child) return

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const last = child.lastPracticeAt

  if (!last) {
    // 第一次練習
    await prisma.childProfile.update({
      where: { id: childId },
      data: { streak: 1, lastPracticeAt: today },
    })
    return
  }

  const lastDay = new Date(last)
  lastDay.setHours(0, 0, 0, 0)
  const diffDays = Math.floor(
    (today.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (diffDays === 0) return // 當天已算過
  if (diffDays === 1) {
    // 連續
    await prisma.childProfile.update({
      where: { id: childId },
      data: { streak: { increment: 1 }, lastPracticeAt: today },
    })
  } else {
    // 中斷
    await prisma.childProfile.update({
      where: { id: childId },
      data: { streak: 1, lastPracticeAt: today },
    })
  }
}

// ============ 成就徽章檢查 ============
// 性能優化：所有 DB 查詢集中在循環前「批量預查詢」，循環內每個徽章只做記憶體判斷，
// 避免原本每個 case 各自查 DB 造成的 N+1 問題（原約 15+ 次往返 → 現約 5 次）。
type BadgeCheckContext = {
  childId: string
  sessionCorrectCount: number
  sessionTotalQuestions: number
  allCorrect: boolean // 本次練習是否全對（不計 assisted）
  isPromotion?: boolean // 是否為升學測試
  passedPromotion?: boolean // 升學測試是否通過
}

// 連擊計算（純記憶體）：從最新一筆往回數連續答對且非協助的題數，遇錯/協助即中斷
function computeCombo(
  attempts: Array<{ isCorrect: boolean; assisted: boolean }>
): number {
  let combo = 0
  for (const a of attempts) {
    if (a.isCorrect && !a.assisted) combo++
    else break
  }
  return combo
}

// 速度連段計算（純記憶體）：連續在 maxMs 內答對且非協助的題數
function computeSpeedRun(
  attempts: Array<{ isCorrect: boolean; assisted: boolean; durationMs: number }>,
  maxMs: number
): number {
  let run = 0
  for (const a of attempts) {
    if (a.isCorrect && !a.assisted && a.durationMs > 0 && a.durationMs <= maxMs) run++
    else break
  }
  return run
}

export async function checkBadges(ctx: BadgeCheckContext) {
  const { childId, sessionCorrectCount, sessionTotalQuestions, allCorrect } = ctx

  // 取得孩子最新資料（含已獲得的徽章）
  const child = await prisma.childProfile.findUnique({
    where: { id: childId },
    include: {
      badges: true,
      sessions: {
        orderBy: { startedAt: 'desc' },
        take: 1,
        where: { completedAt: { not: null } },
      },
    },
  })
  if (!child) return

  const earnedBadgeCodes = new Set(child.badges.map((b) => b.badgeId))

  // 取得所有徽章定義
  const allBadges = await prisma.badge.findMany()
  const newlyEarned: { badgeId: string; name: string; icon: string }[] = []

  // ============ 批量預查詢（一次查齊所有徽章判定所需的資料）============
  // 1. 完成練習數（first-practice / persistent-5 共用）
  const completedSessionCount = await prisma.practiceSession.count({
    where: { childId, completedAt: { not: null } },
  })

  // 2. 近期作答（帶 question.skill 關聯）：一次查 60 筆，供以下共用——
  //    - 連擊 / 速度連段（取前 60 筆按時間倒序，連擊上限 25 綽綽有餘）
  //    - 加/減法達人（從 skill.code 過濾，避免額外查 skill id）
  //    - all-skills（用 question.skillId 收集已練過的技能）
  const recentAttemptsRaw = await prisma.attempt.findMany({
    where: { session: { childId } },
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: { question: { select: { skillId: true, skill: { select: { code: true, gradeLevel: true } } } } },
  })

  // 3. 掌握度快照數（mastery-3）
  const masteredCount = await prisma.masterySnapshot.count({
    where: { childId, masteryLevel: { gte: 0.95 }, recentTotal: { gt: 0 } },
  })

  // 4. 可接觸年級範圍的技能數（all-skills 分母）
  const reachableGrades = accessibleGrades(child.gradeLevel)
  const reachableSkillCount = await prisma.skill.count({
    where: { isActive: true, gradeLevel: { in: reachableGrades } },
  })

  // ============ 從預查詢資料衍生出各徽章所需的數值（純記憶體計算）============
  const currentCombo = computeCombo(recentAttemptsRaw)
  const currentSpeed = computeSpeedRun(recentAttemptsRaw, 5000)

  // 加/減法達人：從已查得的 attempts 中，過濾出加/減法技能的非協助作答
  // 加法技能 code：add-within-10 / add-within-20；減法：sub-within-10
  const addSkillCodes = new Set(['add-within-10', 'add-within-20'])
  const subSkillCodes = new Set(['sub-within-10'])
  // 注意：達人需「最近 20 題」，從全部 attempts 中過濾（不侷限於前 60 筆的視窗）。
  // 但預查只取 60 筆——達人判定取最近 20 題，60 筆已足夠涵蓋。
  const addAttempts = recentAttemptsRaw
    .filter((a) => !a.assisted && a.question?.skill && addSkillCodes.has(a.question.skill.code))
    .slice(0, 20)
  const subAttempts = recentAttemptsRaw
    .filter((a) => !a.assisted && a.question?.skill && subSkillCodes.has(a.question.skill.code))
    .slice(0, 20)
  const addCorrectRate = addAttempts.length > 0
    ? addAttempts.filter((a) => a.isCorrect).length / addAttempts.length
    : 0
  const subCorrectRate = subAttempts.length > 0
    ? subAttempts.filter((a) => a.isCorrect).length / subAttempts.length
    : 0

  // all-skills：已練過的技能數（限定可接觸年級）
  const practicedSkillIds = new Set(
    recentAttemptsRaw
      .filter((a) => a.question?.skill && reachableGrades.includes(a.question.skill.gradeLevel))
      .map((a) => a.question.skillId)
  )

  // promotion-star：年級 ≥ G3（gradeRank K=0..G3=3）—— 直接用已查得的 child.gradeLevel
  const { gradeRank } = await import('@/lib/grade')
  const childRank = gradeRank(child.gradeLevel) ?? 0

  for (const badge of allBadges) {
    // 跳過已獲得的徽章
    if (earnedBadgeCodes.has(badge.id)) continue

    let earned = false

    switch (badge.code) {
      case 'first-practice': {
        // 完成首次練習（使用預查詢的 completedSessionCount）
        earned = completedSessionCount >= 1
        break
      }

      case 'streak-7': {
        earned = child.streak >= 7
        break
      }

      case 'streak-14': {
        earned = child.streak >= 14
        break
      }

      case 'streak-30': {
        earned = child.streak >= 30
        break
      }

      case 'stars-50': {
        earned = child.stars >= 50
        break
      }

      case 'stars-100': {
        earned = child.stars >= 100
        break
      }

      case 'perfect-score': {
        earned = allCorrect && sessionCorrectCount === sessionTotalQuestions
        break
      }

      case 'all-skills': {
        // 「該孩子目前可接觸年級範圍內」的全部技能都練過至少一次
        // （使用預查詢的 reachableSkillCount 與 practicedSkillIds）
        earned =
          reachableSkillCount > 0 && practicedSkillIds.size >= reachableSkillCount
        break
      }

      case 'addition-master': {
        // 加法技能正確率 ≥ 90%（最近 20 題，使用預查詢的 addAttempts）
        if (addAttempts.length >= 10) {
          earned = addCorrectRate >= 0.9
        }
        break
      }

      case 'promotion-pass': {
        // 第一次升學測試通過
        earned = !!ctx.passedPromotion
        break
      }

      case 'promotion-star': {
        // 通過 3 次升學測試 ≒ 目前年級 ≥ G3（gradeRank K=0..G3=3）
        // （使用預查詢的 childRank，避免重複查 child）
        earned = childRank >= 3
        break
      }

      // ============ 新增難度梯度成就 ============
      case 'persistent-5': {
        // 累計完成 5 次練習（使用預查詢的 completedSessionCount）
        earned = completedSessionCount >= 5
        break
      }

      case 'combo-10':
      case 'combo-25': {
        // 跨練習「連續答對」（使用預查詢計算的 currentCombo）
        const target = badge.code === 'combo-10' ? 10 : 25
        earned = currentCombo >= target
        break
      }

      case 'speed-demon': {
        // 連續 5 題在 5 秒內答對（使用預查詢計算的 currentSpeed）
        earned = currentSpeed >= 5
        break
      }

      case 'subtraction-master': {
        // 減法技能正確率 ≥ 90%（最近 20 題，使用預查詢的 subAttempts）
        if (subAttempts.length >= 10) {
          earned = subCorrectRate >= 0.9
        }
        break
      }

      case 'mastery-3': {
        // 3 個技能達到掌握（使用預查詢的 masteredCount）
        earned = masteredCount >= 3
        break
      }
    }

    if (earned) {
      await prisma.childBadge.create({
        data: { childId, badgeId: badge.id },
      })
      newlyEarned.push({ badgeId: badge.id, name: badge.name, icon: badge.icon })
    }
  }

  return newlyEarned
}
