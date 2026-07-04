'use client'

import { useState, useCallback, useEffect } from 'react'
import { startSession } from '@/actions/practice'
import { GRADE_ORDER, canAccessGrade } from '@/lib/grade'

// ============ 型別 ============
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
type GradeStyle = {
  label: string
  icon: string
  gradient: string
  borderColor: string
  hue: string
}

const GRADE_STYLE: Record<string, GradeStyle> = {
  K: { label: '幼兒園', icon: '🧸', gradient: 'from-pink-400 to-rose-400', borderColor: 'border-pink-300 dark:border-pink-700', hue: '#f472b6' },
  G1: { label: '一年級', icon: '📘', gradient: 'from-sky-400 to-blue-500', borderColor: 'border-sky-300 dark:border-sky-700', hue: '#38bdf8' },
  G2: { label: '二年級', icon: '📗', gradient: 'from-emerald-400 to-green-500', borderColor: 'border-emerald-300 dark:border-emerald-700', hue: '#34d399' },
  G3: { label: '三年級', icon: '📙', gradient: 'from-amber-400 to-orange-500', borderColor: 'border-amber-300 dark:border-amber-700', hue: '#fbbf24' },
  G4: { label: '四年級', icon: '📕', gradient: 'from-violet-400 to-purple-500', borderColor: 'border-violet-300 dark:border-violet-700', hue: '#a78bfa' },
  G5: { label: '五年級', icon: '📓', gradient: 'from-teal-400 to-cyan-500', borderColor: 'border-teal-300 dark:border-teal-700', hue: '#2dd4bf' },
  G6: { label: '六年級', icon: '📔', gradient: 'from-fuchsia-400 to-pink-500', borderColor: 'border-fuchsia-300 dark:border-fuchsia-700', hue: '#d946ef' },
}

function gradeStyle(level: string): GradeStyle {
  return GRADE_STYLE[level] ?? { label: level, icon: '📁', gradient: 'from-slate-400 to-slate-500', borderColor: 'border-slate-300 dark:border-slate-700', hue: '#94a3b8' }
}

function isAllMastered(skills: SkillFolderItem[]): boolean {
  return skills.length > 0 && skills.every((s) => s.recentTotal > 0 && s.masteryLevel >= 0.95)
}

// ============ 技能樹主元件 ============
export function SkillTree({
  skills,
  childId,
  childGradeLevel,
}: {
  skills: SkillFolderItem[]
  childId: string
  childGradeLevel: string
}) {
  const groups = new Map<string, SkillFolderItem[]>()
  for (const s of skills) {
    const arr = groups.get(s.gradeLevel) ?? []
    arr.push(s)
    groups.set(s.gradeLevel, arr)
  }

  const displayGrades = [...GRADE_ORDER].reverse()
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null)
  const openModal = useCallback((grade: string) => setSelectedGrade(grade), [])
  const closeModal = useCallback(() => setSelectedGrade(null), [])

  useEffect(() => {
    if (!selectedGrade) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedGrade, closeModal])

  const topCfg = gradeStyle(GRADE_ORDER.findLast((g) => groups.has(g)) ?? 'G6')

  if (skills.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-3 text-5xl">🌱</div>
        <p className="text-sm text-neutral-400 dark:text-gray-500">目前沒有可練習的技能</p>
      </div>
    )
  }

  return (
    <div className="relative mx-auto w-full max-w-2xl px-4 py-6 sm:max-w-3xl lg:max-w-4xl">
      {/* ===== SVG 小樹（左側裝飾，timeline 風格）===== */}
      <div className="pointer-events-none absolute inset-0 flex justify-start overflow-visible sm:justify-center">
        <svg viewBox="0 0 120 1000" className="h-full w-24 sm:w-28" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {/* 樹冠 */}
          <defs>
            <radialGradient id="canopyS" cx="50%" cy="40%" r="50%">
              <stop offset="0%" stopColor={topCfg.hue} stopOpacity="0.25" />
              <stop offset="100%" stopColor={topCfg.hue} stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="60" cy="80" rx="55" ry="60" fill="url(#canopyS)" />
          <ellipse cx="45" cy="90" rx="35" ry="30" fill={topCfg.hue} opacity="0.08" />
          <ellipse cx="75" cy="90" rx="35" ry="30" fill={topCfg.hue} opacity="0.08" />

          {/* 樹幹 */}
          <path d="M57,940 Q55,700 58,500 Q59,300 60,140 Q61,300 62,500 Q65,700 63,940 Z"
                fill={topCfg.hue} opacity="0.10" />
          <path d="M57,940 Q55,700 58,500 Q59,300 60,140"
                stroke={topCfg.hue} strokeWidth="3" fill="none" opacity="0.35" strokeLinecap="round" />
          <path d="M63,940 Q65,700 62,500 Q61,300 60,140"
                stroke={topCfg.hue} strokeWidth="3" fill="none" opacity="0.35" strokeLinecap="round" />

          {/* 樹枝 */}
          <path d="M59,280 Q50,270 20,265" stroke={topCfg.hue} strokeWidth="3" fill="none" opacity="0.25" strokeLinecap="round" />
          <path d="M61,330 Q70,320 100,315" stroke={topCfg.hue} strokeWidth="3" fill="none" opacity="0.25" strokeLinecap="round" />
          <path d="M58,470 Q45,460 15,455" stroke={topCfg.hue} strokeWidth="4" fill="none" opacity="0.25" strokeLinecap="round" />
          <path d="M62,530 Q75,520 105,515" stroke={topCfg.hue} strokeWidth="4" fill="none" opacity="0.25" strokeLinecap="round" />
          <path d="M57,650 Q45,640 15,635" stroke={topCfg.hue} strokeWidth="4" fill="none" opacity="0.25" strokeLinecap="round" />
          <path d="M63,740 Q75,730 105,725" stroke={topCfg.hue} strokeWidth="5" fill="none" opacity="0.25" strokeLinecap="round" />

          {/* 樹根 */}
          <path d="M58,940 Q50,970 40,990" stroke={topCfg.hue} strokeWidth="4" fill="none" opacity="0.20" strokeLinecap="round" />
          <path d="M62,940 Q70,970 80,990" stroke={topCfg.hue} strokeWidth="4" fill="none" opacity="0.20" strokeLinecap="round" />
          <path d="M60,940 Q60,975 60,1000" stroke={topCfg.hue} strokeWidth="3" fill="none" opacity="0.20" strokeLinecap="round" />
        </svg>
      </div>

      {/* ===== 年級節點（卡片在樹的右側）===== */}
      <div className="relative z-10 ml-16 space-y-3 sm:ml-20 sm:pl-4">
        {displayGrades.map((grade) => {
          const gradeSkills = groups.get(grade) ?? []
          const cfg = gradeStyle(grade)
          const isLocked = !canAccessGrade(childGradeLevel, grade)
          const isCurrent = grade === childGradeLevel
          const mastered = isAllMastered(gradeSkills)
          const avgMastery = !isLocked && gradeSkills.length > 0
            ? Math.round(gradeSkills.reduce((sum, s) => sum + s.masteryLevel, 0) / gradeSkills.length * 100)
            : null

          return (
            <div key={grade} className="relative">
              {/* 連接卡片到樹的小圓點 */}
              <div className={`absolute -left-4 top-1/2 z-10 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white shadow-sm dark:border-gray-900 ${
                isLocked ? 'bg-gray-300' : cfg.gradient.split(' ')[0].replace('from-', 'bg-')
              }`} />

              <div
                role="button"
                tabIndex={0}
                onClick={() => { if (!isLocked) openModal(grade) }}
                onKeyDown={(e) => { if (!isLocked && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openModal(grade) } }}
                aria-label={isLocked ? `${cfg.label}（已鎖定）` : `開啟${cfg.label}技能列表`}
                className={`relative w-full rounded-2xl border-2 bg-white/95 p-4 text-left shadow-sm backdrop-blur-sm outline-none transition-all duration-200 dark:bg-gray-900/95 ${
                  isLocked
                    ? `${cfg.borderColor} cursor-not-allowed opacity-50 saturate-50`
                    : `${cfg.borderColor} cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0`
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-2xl shadow-sm ${isLocked ? 'from-gray-300 to-gray-400' : cfg.gradient}`}>
                    {isLocked ? '🔒' : cfg.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-bold">{cfg.label}</h3>
                      {isCurrent && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">目前年級</span>}
                      {mastered && !isLocked && <span className="shrink-0 text-sm">✅</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500 dark:text-gray-400">
                      {isLocked
                        ? `🔒 已鎖定 · ${gradeSkills.length > 0 ? `${gradeSkills.length} 項技能` : '尚無內容'}`
                        : avgMastery !== null ? `掌握度 ${avgMastery}% · ${gradeSkills.length} 項技能` : `${gradeSkills.length} 個練習項目`}
                    </p>
                  </div>
                  {!isLocked && gradeSkills.length > 0 && (
                    <span className="shrink-0 rounded-lg bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                      檢視 →
                    </span>
                  )}
                </div>
                {!isLocked && avgMastery !== null && (
                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                      <div className={`h-full rounded-full transition-all duration-700 ease-out ${avgMastery >= 95 ? 'bg-green-500' : avgMastery >= 60 ? 'bg-blue-500' : avgMastery >= 30 ? 'bg-amber-500' : 'bg-gray-400'}`}
                        style={{ width: `${avgMastery}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ===== 技能彈窗 ===== */}
      {selectedGrade && (
        <GradeModal
          grade={selectedGrade}
          cfg={gradeStyle(selectedGrade)}
          skills={groups.get(selectedGrade) ?? []}
          childId={childId}
          onClose={closeModal}
        />
      )}
    </div>
  )
}

// ============ 年級技能彈窗 ============
function GradeModal({
  grade,
  cfg,
  skills,
  childId,
  onClose,
}: {
  grade: string
  cfg: GradeStyle
  skills: SkillFolderItem[]
  childId: string
  onClose: () => void
}) {
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }
  const avgMastery = skills.length > 0
    ? Math.round(skills.reduce((sum, s) => sum + s.masteryLevel, 0) / skills.length * 100)
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={handleBackdrop}>
      <div className="animate-fade-in-up relative flex max-h-[80vh] w-full max-w-lg flex-col rounded-3xl border-2 bg-white shadow-2xl dark:bg-gray-900" style={{ borderColor: cfg.hue }}>
        <div className={`flex items-center gap-3 rounded-t-3xl px-6 py-4 bg-gradient-to-r ${cfg.gradient} text-white`}>
          <span className="text-3xl">{cfg.icon}</span>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{cfg.label}</h2>
            <p className="text-sm opacity-90">
              {avgMastery !== null ? `平均掌握度 ${avgMastery}% · ${skills.length} 項技能` : `${skills.length} 個練習項目`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-lg transition hover:bg-white/30" aria-label="關閉">✕</button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
          {skills.length === 0 ? (
            <div className="py-8 text-center text-neutral-400 dark:text-gray-500">
              <div className="mb-2 text-4xl">📭</div>
              <p className="text-sm">此年級目前沒有練習項目</p>
            </div>
          ) : (
            skills.map((skill) => <SkillCard key={skill.id} skill={skill} childId={childId} />)
          )}
        </div>
        {avgMastery !== null && (
          <div className="border-t border-gray-100 px-6 py-3 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-500 dark:text-gray-400">整體掌握度</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div className={`h-full rounded-full transition-all duration-700 ${avgMastery >= 95 ? 'bg-green-500' : avgMastery >= 60 ? 'bg-blue-500' : 'bg-amber-500'}`}
                  style={{ width: `${avgMastery}%` }} />
              </div>
              <span className="text-xs font-bold tabular-nums text-neutral-600 dark:text-gray-300">{avgMastery}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============ 單一技能卡片 ============
function SkillCard({ skill, childId }: { skill: SkillFolderItem; childId: string }) {
  const pct = skill.recentTotal > 0 ? Math.round(skill.masteryLevel * 100) : null
  const isMastered = pct !== null && pct >= 95
  const isStarted = pct !== null

  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="truncate text-sm font-semibold">{skill.name}</h4>
          {isMastered && <span className="shrink-0 text-sm">✅</span>}
          {skill.questionCount === 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">尚無題目</span>}
        </div>
        {skill.description && <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-gray-400">{skill.description}</p>}
        {isStarted ? (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div className={`h-full rounded-full transition-all duration-700 ease-out ${isMastered ? 'bg-green-500' : pct! >= 60 ? 'bg-blue-500' : 'bg-amber-500'}`}
                style={{ width: `${pct}%` }} />
            </div>
            <span className="shrink-0 text-xs font-medium tabular-nums text-neutral-500 dark:text-gray-400">{pct}%</span>
          </div>
        ) : (
          <p className="mt-1 text-xs text-neutral-400 dark:text-gray-500">尚未開始練習</p>
        )}
      </div>
      {skill.questionCount > 0 ? (
        <form action={startSession.bind(null, childId, skill.id)}>
          <button type="submit" className="ml-3 shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 active:scale-95">練習</button>
        </form>
      ) : (
        <span className="ml-3 shrink-0 text-xs text-neutral-400 dark:text-gray-500">無題目</span>
      )}
    </div>
  )
}
