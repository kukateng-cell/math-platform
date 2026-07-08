'use client'

import { useState } from 'react'
import { startSession, hasIncompleteSession } from '@/actions/practice'
import { gradeRank } from '@/lib/grade'
import { Icon, type IconName } from './icon'

// ============ 型別（與 getChildSkills 回傳一致）============
export type SkillFolderItem = {
  id: string
  name: string
  description?: string | null
  gradeLevel: string
  questionCount: number
  masteryLevel: number
  recentCorrect: number
  recentTotal: number
}

// ============ 年級視覺設定 ============
// 中文標籤、資料夾圖示、配色（順序與等級比較統一放 lib/grade.ts）

type GradeConfig = { label: string; icon: IconName; accent: string }

const GRADE_CONFIG: Record<string, GradeConfig> = {
  K: { label: '幼兒園', icon: 'book', accent: 'from-pink-400 to-rose-400' },
  G1: { label: '一年級', icon: 'book', accent: 'from-sky-400 to-blue-500' },
  G2: { label: '二年級', icon: 'book', accent: 'from-emerald-400 to-green-500' },
  G3: { label: '三年級', icon: 'book', accent: 'from-amber-400 to-orange-500' },
  G4: { label: '四年級', icon: 'book', accent: 'from-violet-400 to-purple-500' },
  G5: { label: '五年級', icon: 'book', accent: 'from-teal-400 to-cyan-500' },
  G6: { label: '六年級', icon: 'book', accent: 'from-fuchsia-400 to-pink-500' },
}

function gradeConfig(level: string): GradeConfig {
  return (
    GRADE_CONFIG[level] ?? {
      label: level,
      icon: 'folder',
      accent: 'from-slate-400 to-slate-500',
    }
  )
}

// ============ 主元件 ============
export function SkillFolders({
  skills,
  childId,
  childGradeLevel,
}: {
  skills: SkillFolderItem[]
  childId: string
  childGradeLevel: string
}) {
  // 依年級分組（依照定義的年級順序排序）
  const groups = new Map<string, SkillFolderItem[]>()
  for (const s of skills) {
    const arr = groups.get(s.gradeLevel) ?? []
    arr.push(s)
    groups.set(s.gradeLevel, arr)
  }
  const sortedGrades = [...groups.keys()].sort(
    (a, b) => gradeRank(a) - gradeRank(b)
  )

  // 預設展開「孩子目前年級」的資料夾；若該年級沒有技能則展開第一個
  const defaultGrade =
    groups.has(childGradeLevel) ? childGradeLevel : sortedGrades[0]

  const [open, setOpen] = useState<Record<string, boolean>>(
    defaultGrade ? { [defaultGrade]: true } : {}
  )

  const toggle = (g: string) =>
    setOpen((prev) => ({ ...prev, [g]: !prev[g] }))

  if (sortedGrades.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-3 flex justify-center text-neutral-400 dark:text-gray-500"><Icon name="folder-open" className="h-12 w-12" /></div>
        <p className="text-sm text-neutral-400 dark:text-gray-500">
          目前沒有可練習的技能
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sortedGrades.map((grade) => {
        const list = groups.get(grade)!
        const cfg = gradeConfig(grade)
        const isOpen = !!open[grade]
        const isChildGrade = grade === childGradeLevel
        const availableCount = list.filter((s) => s.questionCount > 0).length

        return (
          <div
            key={grade}
            className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition dark:bg-gray-900 ${
              isChildGrade
                ? 'border-blue-300 dark:border-blue-700'
                : 'border-neutral-200 dark:border-gray-700'
            }`}
          >
            {/* ============ 資料夾標頭（可點擊展開/收合）============ */}
            <button
              type="button"
              onClick={() => toggle(grade)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-neutral-50 dark:hover:bg-gray-800/60"
            >
              {/* 資料夾圖示 */}
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${cfg.accent} shadow-sm`}
              >
                <Icon name={cfg.icon} className="h-6 w-6 text-white" />
              </span>

              {/* 年級名稱 + 份數 */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-base font-bold">
                    {cfg.label}
                  </h3>
                  {isChildGrade && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      我的年級
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-neutral-500 dark:text-gray-400">
                  {list.length} 個練習{availableCount < list.length && `（${availableCount} 個可練習）`}
                </p>
              </div>

              {/* 展開/收合箭頭 */}
              <span
                className={`shrink-0 text-neutral-400 transition-transform duration-200 dark:text-gray-500 ${
                  isOpen ? 'rotate-90' : ''
                }`}
              >
                <Icon name="chevron-down" className="h-4 w-4" />
              </span>
            </button>

            {/* ============ 展開內容：該年級的技能清單 ============ */}
            {isOpen && (
              <div className="space-y-2 border-t border-neutral-100 bg-neutral-50/50 p-3 dark:border-gray-800 dark:bg-gray-800/30">
                {list.map((skill) => (
                  <SkillRow
                    key={skill.id}
                    skill={skill}
                    childId={childId}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ============ 單一技能列（沿用原本的練習卡片設計）============
function SkillRow({
  skill,
  childId,
}: {
  skill: SkillFolderItem
  childId: string
}) {
  const rate =
    skill.recentTotal > 0 ? Math.round(skill.masteryLevel * 100) : null
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleStart() {
    if (loading) return
    setLoading(true)
    try {
      // 先檢查是否有未完成的舊 session
      const hasStale = await hasIncompleteSession(childId, skill.id)
      if (hasStale) {
        setConfirming(true)
        setLoading(false)
        return
      }
      // 沒有舊 session → 直接開始
      await startSession(childId, skill.id)
    } catch {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    setLoading(true)
    try {
      await startSession(childId, skill.id)
    } catch {
      setLoading(false)
      setConfirming(false)
    }
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="truncate font-semibold">{skill.name}</h4>
          {skill.questionCount === 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              尚無題目
            </span>
          )}
        </div>
        {skill.description && (
          <p className="mt-1 truncate text-sm text-neutral-600 dark:text-gray-400">
            {skill.description}
          </p>
        )}
        {rate !== null && (
          <p className="mt-1 text-xs text-neutral-400 dark:text-gray-500">
            最近正確率 {rate}%（{skill.recentCorrect}/{skill.recentTotal}）
          </p>
        )}
      </div>
      {skill.questionCount > 0 ? (
        <button
          type="button"
          onClick={handleStart}
          disabled={loading}
          className="ml-3 shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '處理中…' : '練習'}
        </button>
      ) : (
        <span className="ml-3 shrink-0 text-sm text-neutral-400 dark:text-gray-500">
          無題目
        </span>
      )}

      {/* 確認結束舊練習的對話框 */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirming(false)
          }}
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <div className="mb-2 flex justify-center text-amber-500"><Icon name="help-circle" className="h-10 w-10" /></div>
            <h3 className="mb-1 text-center text-lg font-semibold dark:text-white">偵測到進行中的練習</h3>
            <p className="mb-4 text-center text-sm text-neutral-500 dark:text-gray-400">
              這個練習已有未完成的記錄，開始新練習將會結束它。<br />
              要繼續嗎？
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '處理中…' : '確定，開始新練習'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-neutral-300 px-4 py-2.5 text-center text-sm font-medium transition hover:bg-neutral-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
