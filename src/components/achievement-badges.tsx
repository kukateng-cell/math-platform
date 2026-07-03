'use client'

import { useState } from 'react'
import type { BadgeWithProgress } from '@/actions/achievement'

type Props = {
  badges: BadgeWithProgress[]
  /** 簡潔模式（適合嵌入卡片，只顯示已獲得） */
  compact?: boolean
}

const GRADE_COLORS: Record<string, string> = {
  'first-practice': 'from-blue-400 to-cyan-400',
  'streak-7': 'from-orange-400 to-red-400',
  'streak-14': 'from-orange-400 to-red-500',
  'streak-30': 'from-red-400 to-pink-600',
  'stars-50': 'from-yellow-300 to-amber-500',
  'stars-100': 'from-amber-400 to-orange-600',
  'perfect-score': 'from-green-400 to-emerald-500',
  'all-skills': 'from-purple-400 to-indigo-500',
  'addition-master': 'from-sky-400 to-blue-600',
}

function badgeGradient(code: string): string {
  return GRADE_COLORS[code] ?? 'from-slate-400 to-slate-500'
}

export default function AchievementBadges({ badges, compact }: Props) {
  const [detail, setDetail] = useState<BadgeWithProgress | null>(null)
  const earned = badges.filter((b) => b.earned)
  const locked = badges.filter((b) => !b.earned)

  if (compact && earned.length === 0) return null

  // 簡潔模式：只顯示已獲得的徽章（用於嵌入卡片）
  if (compact) {
    return (
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <span className="text-sm font-semibold text-neutral-700 dark:text-gray-200">🏅 成就徽章</span>
          <span className="text-xs text-neutral-400 dark:text-gray-500">（{earned.length}/{badges.length}）</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {earned.slice(0, 6).map((b) => (
            <button
              key={b.id}
              onClick={() => setDetail(b)}
              className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm shadow-sm transition hover:shadow dark:border-amber-800 dark:bg-amber-950"
              title={b.name}
            >
              <span className="text-lg">{b.icon}</span>
              <span className="text-xs font-medium text-amber-800 dark:text-amber-200">{b.name}</span>
            </button>
          ))}
          {earned.length > 6 && (
            <span className="flex items-center text-xs text-neutral-400">+{earned.length - 6}</span>
          )}
        </div>
        {/* 詳情彈窗 */}
        {detail && (
          <BadgeDetail badge={detail} onClose={() => setDetail(null)} />
        )}
      </div>
    )
  }

  // 完整模式
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">🏅 成就徽章</h2>

      {/* 已獲得 */}
      {earned.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-medium text-green-700 dark:text-green-400">
            已獲得（{earned.length}）
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {earned.map((b) => (
              <button
                key={b.id}
                onClick={() => setDetail(b)}
                className={`flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br ${badgeGradient(b.code)} p-4 text-center text-white shadow-md transition hover:scale-105 hover:shadow-lg`}
              >
                <span className="text-3xl sm:text-4xl">{b.icon}</span>
                <span className="text-xs font-bold sm:text-sm">{b.name}</span>
                {b.earnedAt && (
                  <span className="text-[10px] opacity-75">
                    {new Date(b.earnedAt).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 未獲得 */}
      {locked.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-neutral-500 dark:text-gray-400">
            未獲得（{locked.length}）
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {locked.map((b) => (
              <button
                key={b.id}
                onClick={() => setDetail(b)}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-neutral-200 bg-white p-4 text-center transition hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-600 dark:hover:bg-blue-950"
              >
                <span className="text-3xl opacity-30 sm:text-4xl">{b.icon}</span>
                <span className="text-xs font-medium text-neutral-500 dark:text-gray-400">{b.name}</span>
                {/* 進度條 */}
                <div className="w-full">
                  <div className="mb-0.5 flex justify-between text-[10px] text-neutral-400">
                    <span>{b.progressLabel}</span>
                    <span>{b.progress}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-gray-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 transition-all"
                      style={{ width: `${Math.max(b.progress, 3)}%` }}
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 詳情彈窗 */}
      {detail && (
        <BadgeDetail badge={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}

// ============ 徽章詳情彈窗 ============
function BadgeDetail({ badge, onClose }: { badge: BadgeWithProgress; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-xl dark:bg-gray-900">
        <div className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${badgeGradient(badge.code)} text-3xl shadow-md`}>
          {badge.icon}
        </div>
        <h3 className="text-lg font-bold dark:text-white">{badge.name}</h3>
        <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">{badge.condition}</p>

        {badge.earned ? (
          <div className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
            ✅ 已獲得
            {badge.earnedAt && `（${new Date(badge.earnedAt).toLocaleDateString('zh-TW')}）`}
          </div>
        ) : (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-neutral-500">
              <span>{badge.progressLabel}</span>
              <span>{badge.progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-gray-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 transition-all"
                style={{ width: `${Math.max(badge.progress, 3)}%` }}
              />
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium transition hover:bg-neutral-200 dark:bg-gray-800 dark:hover:bg-gray-700"
        >
          關閉
        </button>
      </div>
    </div>
  )
}
