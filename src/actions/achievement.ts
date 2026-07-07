'use server'

import { prisma } from '@/lib/prisma'
import { gradeRank, accessibleGrades } from '@/lib/grade'

export type BadgeWithProgress = {
  id: string
  code: string
  name: string
  icon: string
  condition: string
  earned: boolean
  earnedAt: Date | null
  /** 0-100 達成進度百分比 */
  progress: number
  /** 進度描述文字 */
  progressLabel: string
}

// 取得孩子的完整徽章列表（含進度）
export async function getChildBadges(childId: string): Promise<BadgeWithProgress[]> {
  const child = await prisma.childProfile.findUnique({
    where: { id: childId },
    include: { badges: true },
  })
  if (!child) return []

  const earnedIds = new Set(child.badges.map((b) => b.badgeId))

  // 孩子可接觸的年級範圍（K..當前年級）—— all-skills 門檻應以此為準，
  // 否則低年級孩子永遠拿不到（只能練自己年級及以下）
  const reachableGrades = accessibleGrades(child.gradeLevel)

  // 🔥 平行化所有獨立的 DB 查詢（原本是 10 個串行 → 現在 1 次 round-trip）
  // Supabase 在 ap-south-1（印度），每個查詢 ~150ms 往返延遲。
  // 串行 10 個查詢 = ~1.5s；並行只需 ~150ms（降 90%）。
  const [
    allBadges,
    sessionCount,
    reachableSkillCount,
    attemptsByChild,
    allAttempts,
    addSkillRows,
    subSkillRows,
    recentAttemptsAll,
    masteredCount,
  ] = await Promise.all([
    prisma.badge.findMany(),
    prisma.practiceSession.count({
      where: { childId, completedAt: { not: null } },
    }),
    prisma.skill.count({
      where: { isActive: true, gradeLevel: { in: reachableGrades } },
    }),
    // 練習過的技能數（限定可接觸年級，與門檻一致）
    prisma.attempt.findMany({
      where: { session: { childId }, question: { skill: { gradeLevel: { in: reachableGrades } } } },
      include: { question: { select: { skillId: true } } },
      distinct: ['questionId'],
    }),
    // 近期作答（含 question.skillId 關聯，供加/減法達人正確過濾）
    prisma.attempt.findMany({
      where: { session: { childId }, assisted: false },
      include: { question: { select: { skillId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    // 加法技能（修正：原本缺 question include 導致永遠過濾不出來）
    prisma.skill.findMany({
      where: { code: { in: ['add-within-10', 'add-within-20'] } },
      select: { id: true },
    }),
    // 減法技能（新增徽章用）
    prisma.skill.findMany({
      where: { code: { in: ['sub-within-10'] } },
      select: { id: true },
    }),
    // 連擊 / 速度：需要含 assisted 的完整序列（從最新往回數）
    prisma.attempt.findMany({
      where: { session: { childId } },
      orderBy: { createdAt: 'desc' },
      select: { isCorrect: true, assisted: true, durationMs: true },
      take: 60,
    }),
    // 達到掌握的技能數（masteryLevel ≥ 95%）
    prisma.masterySnapshot.count({
      where: { childId, masteryLevel: { gte: 0.95 }, recentTotal: { gt: 0 } },
    }),
  ])

  const practicedSkillIds = new Set(attemptsByChild.map((a) => a.question.skillId))
  const addSkillIds = addSkillRows.map((s) => s.id)
  const subSkillIds = subSkillRows.map((s) => s.id)
  const addAttempts = allAttempts.filter((a) => addSkillIds.includes(a.question?.skillId ?? ''))
  const addCorrect = addAttempts.filter((a) => a.isCorrect).length
  const subAttempts = allAttempts.filter((a) => subSkillIds.includes(a.question?.skillId ?? ''))
  const subCorrect = subAttempts.filter((a) => a.isCorrect).length

  let combo = 0
  for (const a of recentAttemptsAll) {
    if (a.isCorrect && !a.assisted) combo++
    else break
  }
  let speedRun = 0
  for (const a of recentAttemptsAll) {
    if (a.isCorrect && !a.assisted && a.durationMs > 0 && a.durationMs <= 5000) speedRun++
    else break
  }

  const results: BadgeWithProgress[] = []

  for (const badge of allBadges) {
    const earned = earnedIds.has(badge.id)
    const earnedBadge = child.badges.find((b) => b.badgeId === badge.id)

    let progress = 0
    let progressLabel = ''

    switch (badge.code) {
      case 'first-practice':
        progress = Math.min(100, Math.round((sessionCount / 1) * 100))
        progressLabel = sessionCount >= 1 ? '已完成' : '完成首次練習'
        break
      case 'streak-7':
        progress = Math.min(100, Math.round((child.streak / 7) * 100))
        progressLabel = `${child.streak} / 7 天`
        break
      case 'streak-14':
        progress = Math.min(100, Math.round((child.streak / 14) * 100))
        progressLabel = `${child.streak} / 14 天`
        break
      case 'streak-30':
        progress = Math.min(100, Math.round((child.streak / 30) * 100))
        progressLabel = `${child.streak} / 30 天`
        break
      case 'stars-50':
        progress = Math.min(100, Math.round((child.stars / 50) * 100))
        progressLabel = `${child.stars} / 50 顆`
        break
      case 'stars-100':
        progress = Math.min(100, Math.round((child.stars / 100) * 100))
        progressLabel = `${child.stars} / 100 顆`
        break
      case 'perfect-score':
        progress = earned ? 100 : 0
        progressLabel = earned ? '已達成' : '挑戰一次全對'
        break
      case 'all-skills':
        progress = reachableSkillCount > 0 ? Math.min(100, Math.round((practicedSkillIds.size / reachableSkillCount) * 100)) : 0
        progressLabel = `${practicedSkillIds.size} / ${reachableSkillCount} 技能`
        break
      case 'addition-master':
        progress = addAttempts.length >= 10
          ? Math.min(100, Math.round((addCorrect / addAttempts.length) * 100))
          : Math.min(90, Math.round((addAttempts.length / 10) * 90))
        progressLabel = addAttempts.length >= 10
          ? `正確率 ${Math.round((addCorrect / addAttempts.length) * 100)}%`
          : `需完成 10 題（${addAttempts.length}/10）`
        break
      case 'persistent-5':
        progress = Math.min(100, Math.round((sessionCount / 5) * 100))
        progressLabel = `${sessionCount} / 5 次練習`
        break
      case 'combo-10':
        progress = Math.min(100, Math.round((combo / 10) * 100))
        progressLabel = `目前連擊 ${combo} / 10`
        break
      case 'combo-25':
        progress = Math.min(100, Math.round((combo / 25) * 100))
        progressLabel = `目前連擊 ${combo} / 25`
        break
      case 'speed-demon':
        progress = Math.min(100, Math.round((speedRun / 5) * 100))
        progressLabel = `目前連續 ${speedRun} / 5 題快答`
        break
      case 'subtraction-master':
        progress = subAttempts.length >= 10
          ? Math.min(100, Math.round((subCorrect / subAttempts.length) * 100))
          : Math.min(90, Math.round((subAttempts.length / 10) * 90))
        progressLabel = subAttempts.length >= 10
          ? `正確率 ${Math.round((subCorrect / subAttempts.length) * 100)}%`
          : `需完成 10 題（${subAttempts.length}/10）`
        break
      case 'mastery-3':
        progress = Math.min(100, Math.round((masteredCount / 3) * 100))
        progressLabel = `${masteredCount} / 3 個技能掌握`
        break
      case 'promotion-pass':
        // 第一次升學測試通過：已達成顯示 100，未達成依當前年級是否 > 起點年級推算
        progress = earned ? 100 : (gradeRank(child.gradeLevel) > 0 ? 100 : 0)
        progressLabel = earned ? '已達成' : '通過第一次升學測試'
        break
      case 'promotion-star':
        // 通過 3 次升學測試 ≒ 目前年級 ≥ G3（gradeRank K=0,G1=1,G2=2,G3=3）
        progress = Math.min(100, Math.round((gradeRank(child.gradeLevel) / 3) * 100))
        progressLabel = `目前年級 ${child.gradeLevel}（目標 G3+）`
        break
    }

    results.push({
      id: badge.id,
      code: badge.code,
      name: badge.name,
      icon: badge.icon,
      condition: badge.condition,
      earned,
      earnedAt: earnedBadge?.earnedAt ?? null,
      progress: earned ? 100 : progress,
      progressLabel,
    })
  }

  return results
}
