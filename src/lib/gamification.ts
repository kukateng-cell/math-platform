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
type BadgeCheckContext = {
  childId: string
  sessionCorrectCount: number
  sessionTotalQuestions: number
  allCorrect: boolean // 本次練習是否全對（不計 assisted）
  isPromotion?: boolean // 是否為升學測試
  passedPromotion?: boolean // 升學測試是否通過
}

// 從最新一筆 attempt 往回數「連續答對且非家長協助」的題數
// 一遇到錯誤或 assisted 即中斷（協助代表非孩子獨立答對，視為中斷連擊）
async function currentCombo(childId: string): Promise<number> {
  const attempts = await prisma.attempt.findMany({
    where: { session: { childId } },
    orderBy: { createdAt: 'desc' },
    select: { isCorrect: true, assisted: true },
    take: 60, // 連擊上限 25，取 60 綽綽有餘
  })
  let combo = 0
  for (const a of attempts) {
    if (a.isCorrect && !a.assisted) combo++
    else break
  }
  return combo
}

// 從最新一筆往回數「連續在指定毫秒內答對且非協助」的題數
async function currentSpeedRun(childId: string, maxMs: number): Promise<number> {
  const attempts = await prisma.attempt.findMany({
    where: { session: { childId } },
    orderBy: { createdAt: 'desc' },
    select: { isCorrect: true, assisted: true, durationMs: true },
    take: 30,
  })
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

  for (const badge of allBadges) {
    // 跳過已獲得的徽章
    if (earnedBadgeCodes.has(badge.id)) continue

    let earned = false

    switch (badge.code) {
      case 'first-practice': {
        // 完成首次練習
        const sessionCount = await prisma.practiceSession.count({
          where: { childId, completedAt: { not: null } },
        })
        earned = sessionCount >= 1
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
        // 注意：孩子只能練自己年級及以下的技能（見 lib/grade.ts accessibleGrades），
        // 若門檻用「全年級」技能數，除非升到 G6 否則永遠拿不到（死徽章）。
        // 故改為只計算孩子可存取年級（K..當前年級）內的技能。
        const reachableGrades = accessibleGrades(child.gradeLevel)
        const reachableSkillCount = await prisma.skill.count({
          where: { isActive: true, gradeLevel: { in: reachableGrades } },
        })
        if (reachableSkillCount > 0) {
          const practicedSkills = await prisma.attempt.groupBy({
            by: ['questionId'],
            where: {
              session: { childId },
              question: {
                skill: {
                  isActive: true,
                  gradeLevel: { in: reachableGrades },
                },
              },
            },
          })
          // 取得不重複的 skillId
          const questionsWithSkills = await prisma.questionTemplate.findMany({
            where: {
              id: { in: practicedSkills.map((a) => a.questionId) },
            },
            select: { skillId: true },
            distinct: ['skillId'],
          })
          earned = questionsWithSkills.length >= reachableSkillCount
        }
        break
      }

      case 'addition-master': {
        // 加法技能正確率 ≥ 90%（最近 20 題）
        const addSkillIds = (
          await prisma.skill.findMany({
            where: {
              code: { in: ['add-within-10', 'add-within-20'] },
            },
            select: { id: true },
          })
        ).map((s) => s.id)

        if (addSkillIds.length > 0) {
          const recentAddAttempts = await prisma.attempt.findMany({
            where: {
              session: { childId },
              question: { skillId: { in: addSkillIds } },
              assisted: false,
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
          })

          if (recentAddAttempts.length >= 10) {
            const correctCount = recentAddAttempts.filter((a) => a.isCorrect).length
            const rate = correctCount / recentAddAttempts.length
            earned = rate >= 0.9
          }
        }
        break
      }

      case 'promotion-pass': {
        // 第一次升學測試通過
        earned = !!ctx.passedPromotion
        break
      }

      case 'promotion-star': {
        // 通過 3 次升學測試（gradeRank K=0,G1=1,G2=2,G3=3…）
        // 目前年級 ≥ G3 代表至少通過 3 次
        const { gradeRank } = await import('@/lib/grade')
        const child = await prisma.childProfile.findUnique({
          where: { id: childId },
          select: { gradeLevel: true },
        })
        if (child) {
          const rank = gradeRank(child.gradeLevel) ?? 0
          earned = rank >= 3
        }
        break
      }

      // ============ 新增難度梯度成就 ============
      case 'persistent-5': {
        // 累計完成 5 次練習（比連續天數更親民，斷一天也不會歸零）
        const sessionCount = await prisma.practiceSession.count({
          where: { childId, completedAt: { not: null } },
        })
        earned = sessionCount >= 5
        break
      }

      case 'combo-10':
      case 'combo-25': {
        // 跨練習「連續答對」：從最新一筆 attempt 往回數，遇到錯或協助即中斷
        const target = badge.code === 'combo-10' ? 10 : 25
        earned = (await currentCombo(childId)) >= target
        break
      }

      case 'speed-demon': {
        // 連續 5 題在 5 秒內答對（且非協助）
        earned = (await currentSpeedRun(childId, 5000)) >= 5
        break
      }

      case 'subtraction-master': {
        // 減法技能正確率 ≥ 90%（最近 20 題，仿加法達人）
        const subSkillIds = (
          await prisma.skill.findMany({
            where: { code: { in: ['sub-within-10'] } },
            select: { id: true },
          })
        ).map((s) => s.id)

        if (subSkillIds.length > 0) {
          const recentSubAttempts = await prisma.attempt.findMany({
            where: {
              session: { childId },
              question: { skillId: { in: subSkillIds } },
              assisted: false,
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
          })
          if (recentSubAttempts.length >= 10) {
            const correct = recentSubAttempts.filter((a) => a.isCorrect).length
            earned = correct / recentSubAttempts.length >= 0.9
          }
        }
        break
      }

      case 'mastery-3': {
        // 3 個技能達到掌握（masteryLevel ≥ 95%，且有作答紀錄）
        const masteredCount = await prisma.masterySnapshot.count({
          where: { childId, masteryLevel: { gte: 0.95 }, recentTotal: { gt: 0 } },
        })
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
