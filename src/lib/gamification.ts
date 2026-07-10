import { prisma } from '@/lib/prisma'
import { accessibleGrades } from '@/lib/grade'
import { diffCalendarDays } from '@/lib/timezone'

// ============ 星星獎勵 ============
// 每次練習完成後將此輪獲得的星星加入總數
export async function updateStars(childId: string | null, earnedStars: number) {
  if (!childId) return
  if (earnedStars <= 0) return
  await prisma.childProfile.update({
    where: { id: childId },
    data: { stars: { increment: earnedStars } },
  })
}

// ============ 連續練習天數（Streak）============
// 時區安全：用 Asia/Taipei 時區計算「日曆日」，不依賴伺服器本地時區。
export async function updateStreak(childId: string | null | null) {
  if (!childId) return
  const child = await prisma.childProfile.findUnique({ where: { id: childId } })
  if (!child) return

  const now = new Date()
  const last = child.lastPracticeAt

  if (!last) {
    // 第一次練習
    await prisma.childProfile.update({
      where: { id: childId },
      data: { streak: 1, lastPracticeAt: now },
    })
    return
  }

  // 以目標時區計算上次練習與現在的「日曆日」差
  const diffDays = diffCalendarDays(last, now)

  if (diffDays <= 0) return // 同一天（含未來時間誤差），當天已算過
  if (diffDays === 1) {
    // 連續日：用 updateMany + 條件（lastPracticeAt 不變）確保原子性，
    // 避免併發時兩個請求各自 +1。
    const result = await prisma.childProfile.updateMany({
      where: { id: childId, lastPracticeAt: last },
      data: { streak: { increment: 1 }, lastPracticeAt: now },
    })
    // result.count === 0 代表已被其他請求更新過，不重複 increment
    if (result.count === 0) return
  } else {
    // 中斷（diffDays >= 2）
    await prisma.childProfile.update({
      where: { id: childId },
      data: { streak: 1, lastPracticeAt: now },
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
  isChallenge?: boolean // 是否為提升練習
  kind?: string // P1-4：session kind（NORMAL/PROMOTION/CHALLENGE）
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
        // P2-9：只計 COMPLETED + NORMAL 練習
        where: { status: 'COMPLETED', kind: 'NORMAL' },
      },
    },
  })
  if (!child) return

  const earnedBadgeCodes = new Set(child.badges.map((b) => b.badgeId))

  // 取得所有徽章定義
  // P2-1：只查 active 的徽章，避免已停用的 badge 繼續頒發給新學生
  const allBadges = await prisma.badge.findMany({
    where: { isActive: true },
  })
  const newlyEarned: { badgeId: string; name: string; icon: string }[] = []

  // ============ 批量預查詢（一次查齊所有徽章判定所需的資料）============
  // 1. 完成練習數（first-practice / persistent-5 共用）
  // P2-9：只計 NORMAL 練習
  const completedSessionCount = await prisma.practiceSession.count({
    where: { childId, status: 'COMPLETED', kind: 'NORMAL' },
  })

  // 2. 近期作答（帶 question.skill 關聯）：一次查 60 筆，供以下共用——
  //    - 連擊 / 速度連段（取前 60 筆按時間倒序，連擊上限 25 綽綽有餘）
  //    - 加/減法達人（從 skill.code 過濾，避免額外查 skill id）
  //    - all-skills（用 question.skillId 收集已練過的技能）
  // P2-9：只取 COMPLETED + NORMAL session 的作答
  const recentAttemptsRaw = await prisma.attempt.findMany({
    where: { session: { childId, status: 'COMPLETED', kind: 'NORMAL' } },
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

  // all-skills：已練過的技能數（使用 DB distinct skillId，而非僅最近 60 筆）
  // P2-5：以 DB 查詢結果為準，避免較早練習的技能因超過 60 筆視窗而從集合中消失
  // P2-9：只取 COMPLETED + NORMAL session
  const practicedSkillRows = await prisma.attempt.findMany({
    where: {
      session: { childId, status: 'COMPLETED', kind: 'NORMAL' },
      question: { skill: { gradeLevel: { in: reachableGrades } } },
    },
    distinct: ['questionId'],
    select: { question: { select: { skillId: true } } },
  })
  const practicedSkillIds = new Set(
    practicedSkillRows.filter((a) => a.question).map((a) => a.question!.skillId)
  )

  // P2-6：加/減法達人直接查 DB 取最近 20 題，不依賴 60 筆的快取視窗
  // 加法技能 ID 查詢
  const addSkillRows = await prisma.skill.findMany({
    where: { code: { in: ['add-within-10', 'add-within-20'] } },
    select: { id: true },
  })
  const addSkillIds = addSkillRows.map((s) => s.id)
  const addAttempts = addSkillIds.length > 0 ? await prisma.attempt.findMany({
    where: { session: { childId, status: 'COMPLETED', kind: 'NORMAL' }, question: { skillId: { in: addSkillIds } }, assisted: false },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { isCorrect: true },
  }) : []
  const addCorrectCount = addAttempts.filter((a) => a.isCorrect).length
  const addCorrectRate = addAttempts.length > 0
    ? addCorrectCount / addAttempts.length
    : 0

  // 減法技能 ID 查詢
  const subSkillRows = await prisma.skill.findMany({
    where: { code: { in: ['sub-within-10'] } },
    select: { id: true },
  })
  const subSkillIds = subSkillRows.map((s) => s.id)
  const subAttempts = subSkillIds.length > 0 ? await prisma.attempt.findMany({
    where: { session: { childId, status: 'COMPLETED', kind: 'NORMAL' }, question: { skillId: { in: subSkillIds } }, assisted: false },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { isCorrect: true },
  }) : []
  const subCorrectCount = subAttempts.filter((a) => a.isCorrect).length
  const subCorrectRate = subAttempts.length > 0
    ? subCorrectCount / subAttempts.length
    : 0

  // promotion-star：使用持久化的 promotionCount（P2-7），而非年級推估
  const promotionCount = child.promotionCount ?? 0

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
        // 通過 3 次升學測試（使用持久化的 promotionCount，P2-7）
        earned = promotionCount >= 3
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

      case 'challenge-first': {
        // 第一次完成提升練習
        earned = !!ctx.isChallenge
        break
      }

      case 'challenge-all-correct': {
        // 提升練習全對
        earned = !!ctx.isChallenge && ctx.allCorrect && ctx.sessionCorrectCount === ctx.sessionTotalQuestions
        break
      }
    }

    if (earned) {
      // P2-8：使用 upsert 而非 create，避免併發完成時因 unique constraint 衝突而失敗
      await prisma.childBadge.upsert({
        where: { childId_badgeId: { childId, badgeId: badge.id } },
        update: {}, // 已存在則不更新
        create: { childId, badgeId: badge.id },
      })
      newlyEarned.push({ badgeId: badge.id, name: badge.name, icon: badge.icon })
    }
  }

  return newlyEarned
}
