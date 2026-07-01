import { prisma } from '@/lib/prisma'

// ============ 掌握度快照更新 ============
// 每次練習結束後，依最近 N 題（不計 assisted）重算掌握度
const RECENT_WINDOW = 5

export async function updateMastery(sessionId: string) {
  const practiceSession = await prisma.practiceSession.findUnique({
    where: { id: sessionId },
    include: { child: true },
  })
  if (!practiceSession) return

  const { childId, skillId } = practiceSession

  // 取該技能最近 RECENT_WINDOW 題（非 assisted），按時間倒序
  const recentAttempts = await prisma.attempt.findMany({
    where: {
      session: { childId, skillId },
      assisted: false,
    },
    orderBy: { createdAt: 'desc' },
    take: RECENT_WINDOW,
  })

  const recentCorrect = recentAttempts.filter((a) => a.isCorrect).length
  const recentTotal = recentAttempts.length
  // 掌握度：用最近正確率作為簡單估計
  const masteryLevel = recentTotal > 0 ? recentCorrect / recentTotal : 0

  await prisma.masterySnapshot.upsert({
    where: { childId_skillId: { childId, skillId } },
    update: { recentCorrect, recentTotal, masteryLevel },
    create: { childId, skillId, recentCorrect, recentTotal, masteryLevel },
  })
}

// ============ 規則式推薦 ============
// 計畫的規則：
//  - 最近 5 題錯 3 題（正確率 < 40%）：回前置技能
//  - 連續答對 5 題（正確率 = 100%）：推薦下一個技能
//  - 60%-80%：保持當前技能多練一組
export type Recommendation = {
  type: 'PRACTICE_PREREQ' | 'ADVANCE' | 'KEEP' | 'START_FIRST' | 'ALL_DONE'
  skillId?: string
  skillName?: string
  reason: string
}

export function getRecommendation(
  skills: { id: string; prerequisiteId: string | null }[],
  mastery: { skillId: string; recentCorrect: number; recentTotal: number; masteryLevel: number }[]
): Recommendation {
  // 還沒練過任何技能 → 從第一個開始
  if (mastery.length === 0) {
    const first = skills[0]
    if (!first) return { type: 'START_FIRST', reason: '尚未有可用技能' }
    const skill = first as { id: string; prerequisiteId: string | null; name?: string }
    return {
      type: 'START_FIRST',
      skillId: skill.id,
      skillName: skill.name ?? '第一個技能',
      reason: '建議從第一個技能開始建立基礎',
    }
  }

  // 找出當前正在練、且掌握度未達 100% 的最低順序技能
  for (const skill of skills) {
    const m = mastery.find((x) => x.skillId === skill.id)
    if (!m) continue

    const rate = m.recentTotal > 0 ? m.recentCorrect / m.recentTotal : 0

    // 規則 1：正確率過低 → 回前置技能
    if (m.recentTotal >= 5 && rate < 0.4 && skill.prerequisiteId) {
      const prereq = skills.find((s) => s.id === skill.prerequisiteId)
      return {
        type: 'PRACTICE_PREREQ',
        skillId: skill.prerequisiteId,
        skillName: (prereq as { name?: string })?.name ?? '前置技能',
        reason: '最近表現偏低，建議先複習前置技能打好基礎',
      }
    }

    // 規則 2：完全答對 → 晉級下一個技能
    if (m.recentTotal >= 5 && rate === 1) {
      const next = skills.find((s) => s.prerequisiteId === skill.id)
      if (next) {
        return {
          type: 'ADVANCE',
          skillId: next.id,
          skillName: (next as { name?: string })?.name ?? '下一個技能',
          reason: '表現優異，可以挑戰下一個技能！',
        }
      }
      // 已是最後一個技能且都掌握
      return { type: 'ALL_DONE', reason: '太棒了！目前所有技能都已掌握 🎉' }
    }

    // 規則 3：中間值 → 保持當前技能
    if (rate < 1) {
      return {
        type: 'KEEP',
        skillId: skill.id,
        skillName: (skill as { name?: string })?.name ?? '當前技能',
        reason: '繼續保持，多練一組會更熟練',
      }
    }
  }

  return { type: 'KEEP', reason: '繼續加油！' }
}
