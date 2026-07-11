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
  // P2-9：只取 COMPLETED + NORMAL session 的作答
  const recentAttempts = await prisma.attempt.findMany({
    where: {
      session: { childId, skillId, status: 'COMPLETED', kind: 'NORMAL' },
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

// ============ 規則式推薦（明確狀態機）============
// 推薦結果依照下列狀態順序判斷，每個狀態有明確的進入條件與輸出：
//
//   1. 未開始          → START_FIRST     （尚無任何練習紀錄）
//   2. 全部完成        → ALL_DONE        （所有技能皆已掌握）
//   3. 掌握後晉級      → ADVANCE         （前置已掌握、目標技能尚未練習）
//   4. 低正確率回前置  → PRACTICE_PREREQ （目標技能表現過低，回頭複習前置）
//   5. 保持當前        → KEEP            （其餘情況：繼續練習當前技能）
//
// 「目標技能」(frontier) = 技能序列中第一個尚未完全掌握的技能。
//   - 技能序列假設呼叫端已依教學順序（年級 → order）排序。
//   - 採用 frontier（序列中第一個未掌握者）而非 prerequisite 反查，
//     如此多個 dependent 分支時能穩定選到順序最前者，而非任意取一個。
// 「完全掌握」= recentTotal >= MASTERY_SAMPLES 且 正確率 >= MASTERY_THRESHOLD。
export type Recommendation = {
  type: 'PRACTICE_PREREQ' | 'ADVANCE' | 'KEEP' | 'START_FIRST' | 'ALL_DONE'
  skillId?: string
  skillName?: string
  reason: string
}

const MASTERY_SAMPLES = 5      // 判定掌握所需的最低樣本數
const MASTERY_THRESHOLD = 0.95 // 正確率達此門檻（且樣本足夠）視為已掌握
const LOW_RATE_THRESHOLD = 0.4 // 正確率低於此門檻（且樣本足夠）→ 回前置

// 判斷單一技能是否已「完全掌握」
function isMastered(
  m: { recentCorrect: number; recentTotal: number } | undefined
): boolean {
  if (!m || m.recentTotal < MASTERY_SAMPLES) return false
  return m.recentCorrect / m.recentTotal >= MASTERY_THRESHOLD
}

export function getRecommendation(
  skills: { id: string; prerequisiteId: string | null; name?: string }[],
  mastery: { skillId: string; recentCorrect: number; recentTotal: number; masteryLevel: number }[]
): Recommendation {
  // 邊界：完全沒有可用技能
  if (skills.length === 0) {
    return { type: 'START_FIRST', reason: '尚未有可用技能' }
  }

  // 建立 skillId → mastery 查詢表，避免重複 find
  const masteryMap = new Map(mastery.map((m) => [m.skillId, m]))

  // ---- 狀態 1：未開始（完全沒有練習紀錄）----
  const hasAnyPractice = mastery.some((m) => m.recentTotal > 0)
  if (!hasAnyPractice) {
    const first = skills[0]
    return {
      type: 'START_FIRST',
      skillId: first.id,
      skillName: first.name ?? '第一個技能',
      reason: '建議從第一個技能開始建立基礎',
    }
  }

  // ---- 找出目標技能（frontier）：序列中第一個尚未完全掌握的技能 ----
  const frontierIndex = skills.findIndex((s) => !isMastered(masteryMap.get(s.id)))
  const frontier = frontierIndex >= 0 ? skills[frontierIndex] : null

  // ---- 狀態 2：全部完成（所有技能皆已掌握）----
  if (!frontier) {
    return { type: 'ALL_DONE', reason: '太棒了！目前所有技能都已掌握 🎉' }
  }

  const frontierMastery = masteryMap.get(frontier.id)
  const frontierHasPractice = !!frontierMastery && frontierMastery.recentTotal > 0

  // ---- 狀態 3：掌握後晉級（目標技能尚未練習）----
  // frontier 是第一個「未掌握且未練習」的技能；
  // 因為在它之前的技能都掌握了我們才會走到這裡，代表可以晉級到此。
  // 若 frontier 本身就是序列首項（前面沒有已掌握的技能）→ 視為從頭開始。
  if (!frontierHasPractice) {
    if (frontierIndex > 0) {
      return {
        type: 'ADVANCE',
        skillId: frontier.id,
        skillName: frontier.name ?? '下一個技能',
        reason: '表現優異，可以挑戰下一個技能！',
      }
    }
    return {
      type: 'START_FIRST',
      skillId: frontier.id,
      skillName: frontier.name ?? '第一個技能',
      reason: '建議從第一個技能開始建立基礎',
    }
  }

  // frontier 已有練習紀錄，計算正確率
  const rate = frontierMastery!.recentTotal > 0
    ? frontierMastery!.recentCorrect / frontierMastery!.recentTotal
    : 0

  // ---- 狀態 4：低正確率回前置（樣本足夠且正確率過低，且有前置技能）----
  if (
    frontierMastery!.recentTotal >= MASTERY_SAMPLES &&
    rate < LOW_RATE_THRESHOLD &&
    frontier.prerequisiteId
  ) {
    const prereq = skills.find((s) => s.id === frontier.prerequisiteId)
    return {
      type: 'PRACTICE_PREREQ',
      skillId: frontier.prerequisiteId,
      skillName: prereq?.name ?? '前置技能',
      reason: '最近表現偏低，建議先複習前置技能打好基礎',
    }
  }

  // ---- 狀態 5：保持當前（繼續練習當前技能）----
  return {
    type: 'KEEP',
    skillId: frontier.id,
    skillName: frontier.name ?? '當前技能',
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
