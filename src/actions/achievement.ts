'use server'

import { prisma } from '@/lib/prisma'
import { gradeRank } from '@/lib/grade'

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
  const allBadges = await prisma.badge.findMany()

  // 收集各項數據以供進度計算
  const sessionCount = await prisma.practiceSession.count({
    where: { childId, completedAt: { not: null } },
  })
  const totalSkills = await prisma.skill.count({ where: { isActive: true } })
  const allSessions = await prisma.practiceSession.count({
    where: { childId, completedAt: { not: null } },
  })

  // 練習過的技能數
  const attemptsByChild = await prisma.attempt.findMany({
    where: { session: { childId } },
    include: { question: { select: { skillId: true } } },
    distinct: ['questionId'],
  })
  const practicedSkillIds = new Set(attemptsByChild.map((a) => a.question.skillId))

  // 乘法相關徽章的答題統計
  const allAttempts = await prisma.attempt.findMany({
    where: { session: { childId }, assisted: false },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  const correctCount = allAttempts.filter((a) => a.isCorrect).length

  // 加法技能作答
  const addSkills = await prisma.skill.findMany({
    where: { code: { in: ['add-within-10', 'add-within-20'] } },
    select: { id: true },
  })
  const addSkillIds = addSkills.map((s) => s.id)
  const addAttempts = allAttempts.filter((a) => addSkillIds.includes((a as any).question?.skillId ?? ''))
  const addCorrect = addAttempts.filter((a) => a.isCorrect).length

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
        progress = totalSkills > 0 ? Math.min(100, Math.round((practicedSkillIds.size / totalSkills) * 100)) : 0
        progressLabel = `${practicedSkillIds.size} / ${totalSkills} 技能`
        break
      case 'addition-master':
        progress = addAttempts.length >= 10
          ? Math.min(100, Math.round((addCorrect / addAttempts.length) * 100))
          : Math.min(90, Math.round((addAttempts.length / 10) * 90))
        progressLabel = addAttempts.length >= 10
          ? `正確率 ${Math.round((addCorrect / addAttempts.length) * 100)}%`
          : `需完成 10 題（${addAttempts.length}/10）`
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
