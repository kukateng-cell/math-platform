// ====================================================================
// 資料匯出（家長 / Admin 共用）
// --------------------------------------------------------------------
// 把一個孩子（或全部孩子）的學習資料組成 CsvTable，
// 供 route handler 轉成 CSV 下載。遵循 GDPR「資料可攜權」精神。
//
// 安全：呼叫端必須先驗證身分（家長能看自己的孩子 / Admin 全部）。
// ====================================================================

import { prisma } from '@/lib/prisma'
import { tableToCsv, tableBody, type CsvTable } from '@/lib/csv'

/** 年級代碼 → 中文（匯出時更易讀） */
function gradeLabel(level: string): string {
  const map: Record<string, string> = {
    K: '幼兒園', G1: '一年級', G2: '二年級', G3: '三年級', G4: '四年級',
    G5: '五年級', G6: '六年級',
  }
  return map[level] ?? level
}

// ============ 單一孩子的資料表組 ============

function childProfileTable(
  child: {
    id: string
    nickname: string
    email: string | null
    gradeLevel: string
    mode: string
    stars: number
    streak: number
    lastPracticeAt: Date | null
    createdAt: Date
  },
  parentEmail: string | null,
): CsvTable {
  return {
    columns: [
      { key: 'field', label: '欄位' },
      { key: 'value', label: '值' },
    ],
    rows: [
      { field: '孩子暱稱', value: child.nickname },
      { field: '孩子 Email', value: child.email ?? '（家長建檔，無獨立 Email）' },
      { field: '年級', value: gradeLabel(child.gradeLevel) },
      { field: '帳號模式', value: child.mode === 'STANDARD' ? '標準（家長管理）' : '自主學習' },
      { field: '歸屬家長 Email', value: parentEmail ?? '（無）' },
      { field: '累計星星', value: child.stars },
      { field: '連續練習天數', value: child.streak },
      { field: '上次練習時間', value: child.lastPracticeAt ?? '尚未練習' },
      { field: '檔案建立時間', value: child.createdAt },
    ],
  }
}

function sessionsTable(
  sessions: {
    id: string
    skillName: string
    gradeLevel: string
    startedAt: Date
    completedAt: Date | null
    totalQuestions: number
    correctCount: number
  }[],
): CsvTable {
  return {
    columns: [
      { key: 'startedAt', label: '開始時間' },
      { key: 'completedAt', label: '完成時間' },
      { key: 'gradeLevel', label: '年級' },
      { key: 'skillName', label: '技能' },
      { key: 'totalQuestions', label: '題數' },
      { key: 'correctCount', label: '答對' },
      { key: 'accuracy', label: '正確率' },
    ],
    rows: sessions.map((s) => ({
      startedAt: s.startedAt,
      completedAt: s.completedAt ?? '未完成',
      gradeLevel: gradeLabel(s.gradeLevel),
      skillName: s.skillName,
      totalQuestions: s.totalQuestions,
      correctCount: s.correctCount,
      accuracy:
        s.totalQuestions > 0
          ? `${Math.round((s.correctCount / s.totalQuestions) * 100)}%`
          : '-',
    })),
  }
}

function attemptsTable(
  attempts: {
    createdAt: Date
    skillName: string
    questionPrompt: string
    userAnswer: string
    correctAnswer: string
    isCorrect: boolean
    assisted: boolean
    durationMs: number
  }[],
): CsvTable {
  return {
    columns: [
      { key: 'createdAt', label: '作答時間' },
      { key: 'skillName', label: '技能' },
      { key: 'questionPrompt', label: '題目' },
      { key: 'userAnswer', label: '你的答案' },
      { key: 'correctAnswer', label: '正確答案' },
      { key: 'isCorrect', label: '是否答對' },
      { key: 'assisted', label: '家長協助' },
      { key: 'durationSec', label: '作答秒數' },
    ],
    rows: attempts.map((a) => ({
      createdAt: a.createdAt,
      skillName: a.skillName,
      questionPrompt: a.questionPrompt,
      userAnswer: a.userAnswer,
      correctAnswer: a.correctAnswer,
      isCorrect: a.isCorrect,
      assisted: a.assisted,
      durationSec: a.durationMs > 0 ? (a.durationMs / 1000).toFixed(1) : '-',
    })),
  }
}

function masteryTable(
  snapshots: {
    skillName: string
    gradeLevel: string
    recentCorrect: number
    recentTotal: number
    masteryLevel: number
    updatedAt: Date
  }[],
): CsvTable {
  return {
    columns: [
      { key: 'skillName', label: '技能' },
      { key: 'gradeLevel', label: '年級' },
      { key: 'recentCorrect', label: '最近答對' },
      { key: 'recentTotal', label: '最近題數' },
      { key: 'masteryPct', label: '掌握度' },
      { key: 'updatedAt', label: '更新時間' },
    ],
    rows: snapshots.map((m) => ({
      skillName: m.skillName,
      gradeLevel: gradeLabel(m.gradeLevel),
      recentCorrect: m.recentCorrect,
      recentTotal: m.recentTotal,
      masteryPct: `${Math.round(m.masteryLevel * 100)}%`,
      updatedAt: m.updatedAt,
    })),
  }
}

function badgesTable(
  badges: { badgeName: string; badgeIcon: string; earnedAt: Date }[],
): CsvTable {
  return {
    columns: [
      { key: 'badgeName', label: '徽章' },
      { key: 'earnedAt', label: '獲得時間' },
    ],
    rows: badges.map((b) => ({
      badgeName: `${b.badgeIcon} ${b.badgeName}`,
      earnedAt: b.earnedAt,
    })),
  }
}

/**
 * 取得單一孩子的完整 CSV（4 個區塊：檔案 / 練習 / 作答 / 掌握度 / 徽章）。
 * 呼叫端須已確認身分可存取此 childId。
 *
 * 安全限制：最多匯出最近 500 筆 sessions，避免資料過多造成超時。
 */
export async function buildChildCsv(childId: string): Promise<{ nickname: string; csv: string }> {
  const child = await prisma.childProfile.findUnique({
    where: { id: childId },
    include: {
      parent: { select: { email: true } },
      sessions: {
        where: { status: 'COMPLETED' },
        orderBy: { startedAt: 'desc' },
        take: 500, // 最多匯出 500 筆
        include: { skill: { select: { name: true, gradeLevel: true } } },
      },
      masterySnapshots: {
        include: { skill: { select: { name: true, gradeLevel: true } } },
      },
      badges: { include: { badge: true }, orderBy: { earnedAt: 'desc' } },
    },
  })
  if (!child) throw new Error('找不到孩子檔案')

  // 作答明細（跨所有 session）
  const attempts = await prisma.attempt.findMany({
    where: { session: { childId } },
    orderBy: { createdAt: 'desc' },
    include: { session: { include: { skill: { select: { name: true } } } } },
  })

  const blocks: { name: string; table: CsvTable }[] = [
    { name: '孩子檔案', table: childProfileTable(child, child.parent?.email ?? null) },
    {
      name: '練習紀錄',
      table: sessionsTable(
        child.sessions.map((s) => ({
          id: s.id,
          skillName: s.skill.name,
          gradeLevel: s.skill.gradeLevel,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
          totalQuestions: s.totalQuestions,
          correctCount: s.correctCount,
        })),
      ),
    },
    {
      name: '作答明細',
      table: attemptsTable(
        attempts.map((a) => ({
          createdAt: a.createdAt,
          skillName: a.session.skill.name,
          questionPrompt: a.questionPrompt,
          userAnswer: a.userAnswer,
          correctAnswer: a.correctAnswer,
          isCorrect: a.isCorrect,
          assisted: a.assisted,
          durationMs: a.durationMs,
        })),
      ),
    },
    {
      name: '技能掌握度',
      table: masteryTable(
        child.masterySnapshots.map((m) => ({
          skillName: m.skill.name,
          gradeLevel: m.skill.gradeLevel,
          recentCorrect: m.recentCorrect,
          recentTotal: m.recentTotal,
          masteryLevel: m.masteryLevel,
          updatedAt: m.updatedAt,
        })),
      ),
    },
    {
      name: '獲得徽章',
      table: badgesTable(
        child.badges.map((b) => ({
          badgeName: b.badge.name,
          badgeIcon: b.badge.icon,
          earnedAt: b.earnedAt,
        })),
      ),
    },
  ]

  // 合併：整份檔案只在最前面加一個 BOM（用 tableBody 避免每段都帶 BOM）
  const csv = '\uFEFF' + blocks
    .map(({ name, table }) => `# ${name}\r\n${tableBody(table)}`)
    .join('\r\n\r\n')

  return { nickname: child.nickname, csv }
}

/**
 * Admin 用：匯出全部孩子的「練習紀錄」總表（單一 CSV）。
 * 適合平台營運分析，不包含逐題作答明細（太大量）。
 */
export async function buildAllChildrenCsv(): Promise<string> {
  const children = await prisma.childProfile.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      parent: { select: { email: true } },
      sessions: {
        where: { status: 'COMPLETED' },
        orderBy: { startedAt: 'desc' },
        include: { skill: { select: { name: true, gradeLevel: true } } },
      },
    },
  })

  const rows: CsvTable['rows'] = []
  for (const c of children) {
    if (c.sessions.length === 0) {
      rows.push({
        childNickname: c.nickname,
        childEmail: c.email ?? '',
        gradeLevel: gradeLabel(c.gradeLevel),
        parentEmail: c.parent?.email ?? '',
        startedAt: '（無練習紀錄）',
        completedAt: '',
        skillName: '',
        totalQuestions: '',
        correctCount: '',
        accuracy: '',
      })
      continue
    }
    for (const s of c.sessions) {
      rows.push({
        childNickname: c.nickname,
        childEmail: c.email ?? '',
        gradeLevel: gradeLabel(c.gradeLevel),
        parentEmail: c.parent?.email ?? '',
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        skillName: s.skill.name,
        totalQuestions: s.totalQuestions,
        correctCount: s.correctCount,
        accuracy:
          s.totalQuestions > 0
            ? `${Math.round((s.correctCount / s.totalQuestions) * 100)}%`
            : '-',
      })
    }
  }

  const table: CsvTable = {
    columns: [
      { key: 'childNickname', label: '孩子暱稱' },
      { key: 'childEmail', label: '孩子 Email' },
      { key: 'gradeLevel', label: '年級' },
      { key: 'parentEmail', label: '歸屬家長 Email' },
      { key: 'startedAt', label: '開始時間' },
      { key: 'completedAt', label: '完成時間' },
      { key: 'skillName', label: '技能' },
      { key: 'totalQuestions', label: '題數' },
      { key: 'correctCount', label: '答對' },
      { key: 'accuracy', label: '正確率' },
    ],
    rows,
  }
  return tableToCsv(table)
}
