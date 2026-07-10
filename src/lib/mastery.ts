import { prisma } from '@/lib/prisma'
import type { GradeLevel } from '@/generated/prisma'

// ============ 掌握度快照更新 ============
// 每次練習結束後，依最近 N 題（不計 assisted）重算掌握度
const RECENT_WINDOW = 5

export async function updateMastery(sessionId: string) {
  const practiceSession = await prisma.practiceSession.findUnique({
    where: { id: sessionId },
    include: { child: true },
  })
  if (!practiceSession) return

  // P1-6：Challenge/Promotion session 不更新掌握度
  if (practiceSession.kind !== 'NORMAL') return

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
  skills: { id: string; prerequisiteId: string | null; name?: string }[],
  mastery: { skillId: string; recentCorrect: number; recentTotal: number; masteryLevel: number }[]
): Recommendation {
  // 還沒練過任何技能 → 從第一個開始
  if (mastery.length === 0) {
    const first = skills[0]
    if (!first) return { type: 'START_FIRST', reason: '尚未有可用技能' }
    return {
      type: 'START_FIRST',
      skillId: first.id,
      skillName: first.name ?? '第一個技能',
      reason: '建議從第一個技能開始建立基礎',
    }
  }

  // 找出「當前正在練的技能」：最近有作答紀錄的技能
  // P2-14：不再跳過已掌握的技能（避免 ADVANCE 分支無法到達）。
  // 從已練習過的技能中，依 order 找出練習進度中最前面的未完全掌握技能。
  let allMastered = true
  let currentSkill: (typeof skills)[0] | null = null
  let currentMastery: (typeof mastery)[0] | null = null
  let needCheckAdvance = false // 當前技能已掌握，需檢查是否可晉級

  for (const skill of skills) {
    const m = mastery.find((x) => x.skillId === skill.id)
    if (!m || m.recentTotal === 0) {
      // 還沒練過這個技能：如果前面的技能都掌握了，這就是下一個目標
      if (allMastered) {
        currentSkill = skill
        currentMastery = null
        break
      }
      continue
    }

    const rate = m.recentCorrect / m.recentTotal

    if (rate >= 0.95) {
      // 已掌握 → 記錄起來，繼續檢查後續技能
      // 但不跳過：若下個技能尚未練習，則此為「可晉級」狀態
      allMastered = true
      currentSkill = skill
      currentMastery = m
      needCheckAdvance = true
      continue
    }

    // 正確率 < 95% → 這是當前需要練習的技能
    allMastered = false
    currentSkill = skill
    currentMastery = m
    needCheckAdvance = false
    break
  }

  // 所有技能都掌握（或沒任何技能）
  if (!currentSkill) {
    return allMastered
      ? { type: 'ALL_DONE', reason: '太棒了！目前所有技能都已掌握 🎉' }
      : { type: 'KEEP', reason: '繼續加油！' }
  }

  // 沒有 mastery 紀錄 → 當前技能是下一個要練的
  if (!currentMastery) {
    return {
      type: 'KEEP',
      skillId: currentSkill.id,
      skillName: currentSkill.name ?? '下一個技能',
      reason: '準備好了嗎？試試這個新技能！',
    }
  }

  const rate = currentMastery.recentTotal > 0
    ? currentMastery.recentCorrect / currentMastery.recentTotal
    : 0

  // 規則 1：正確率過低（< 40%）且有足夠樣本數 → 回前置技能
  if (!needCheckAdvance && currentMastery.recentTotal >= 5 && rate < 0.4 && currentSkill.prerequisiteId) {
    const prereq = skills.find((s) => s.id === currentSkill.prerequisiteId)
    return {
      type: 'PRACTICE_PREREQ',
      skillId: currentSkill.prerequisiteId,
      skillName: prereq?.name ?? '前置技能',
      reason: '最近表現偏低，建議先複習前置技能打好基礎',
    }
  }

  // 規則 2：掌握（rate >= 95%）且樣本夠 → 晉級下一個技能
  // P2-14 修復：needCheckAdvance 在 loop 中正確設為 true 而非被跳過
  if (needCheckAdvance && currentMastery.recentTotal >= 5 && rate >= 0.95) {
    const next = skills.find((s) => s.prerequisiteId === currentSkill.id)
    if (next) {
      return {
        type: 'ADVANCE',
        skillId: next.id,
        skillName: next.name ?? '下一個技能',
        reason: '表現優異，可以挑戰下一個技能！',
      }
    }
    return { type: 'ALL_DONE', reason: '太棒了！目前所有技能都已掌握 🎉' }
  }

  // 規則 3：中間值（有練習但未掌握）→ 保持當前技能
  return {
    type: 'KEEP',
    skillId: currentSkill.id,
    skillName: currentSkill.name ?? '當前技能',
    reason: rate >= 0.6
      ? '繼續保持，多練一組會更熟練'
      : '再加把勁，多練習幾次就會了',
  }
}

// ============ 年級完成度檢查 ============
// 檢查某年級的所有技能是否都已掌握（masteryLevel >= 0.95）
export async function isGradeAllMastered(
  childId: string,
  gradeLevel: string
): Promise<boolean> {
  const skills = await prisma.skill.findMany({
    where: { gradeLevel: gradeLevel as GradeLevel, isActive: true },
    select: { id: true },
  })
  if (skills.length === 0) return false

  const snapshots = await prisma.masterySnapshot.findMany({
    where: { childId, skillId: { in: skills.map((s) => s.id) } },
  })

  return skills.every((skill) => {
    const snap = snapshots.find((s) => s.skillId === skill.id)
    return snap && snap.recentTotal > 0 && snap.masteryLevel >= 0.95
  })
}
