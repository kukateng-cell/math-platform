import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getChildSession } from '@/lib/child-session'
import { prisma } from '@/lib/prisma'
import { getChildSkills } from '@/actions/practice'
import { getChildBadges } from '@/actions/achievement'
import AchievementBadges from '@/components/achievement-badges'
import GradeSelector from '@/components/grade-selector'
import type { Recommendation } from '@/lib/mastery'

// ============ 授權輔助 ============
// 孩子檔案頁同時支援兩種身分：
// - 家長（家長 session）：可查看自己建立/綁定的孩子
// - 孩子（自主學習 session）：只能查看自己的檔案
type OverviewAuth =
  | { type: 'parent'; userId: string }
  | { type: 'child'; childId: string }
  | null

async function getOverviewAuth(): Promise<OverviewAuth> {
  const session = await getSession()
  if (session) return { type: 'parent', userId: session.userId }

  const childSession = await getChildSession()
  if (childSession) return { type: 'child', childId: childSession.childId }

  return null
}

// ============ 相對時間輔助 ============
function relativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return '剛剛'
  if (mins < 60) return `${mins} 分鐘前`
  if (hours < 24) return `${hours} 小時前`
  if (days < 7) return `${days} 天前`
  return d.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })
}

// ============ 年級中文 ============
function gradeLabel(level: string): string {
  const map: Record<string, string> = { K: '幼兒園', G1: '一年級', G2: '二年級', G3: '三年級', G4: '四年級' }
  return map[level] ?? level
}

// ============ 推薦區塊 ============
function RecommendationBanner({
  rec,
  childId,
}: {
  rec: Recommendation
  childId: string
}) {
  if (rec.type === 'ALL_DONE') {
    return (
      <div className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-green-400 to-emerald-500 p-6 text-center text-white shadow-lg">
        <div className="mb-2 text-5xl">🎉</div>
        <h3 className="text-xl font-bold">{rec.reason}</h3>
        <p className="mt-1 text-green-100">所有技能都已掌握，非常厲害！</p>
      </div>
    )
  }

  const config: Record<string, { bg: string; icon: string }> = {
    START_FIRST: { bg: 'from-blue-500 to-indigo-600', icon: '🚀' },
    KEEP: { bg: 'from-blue-500 to-indigo-600', icon: '💪' },
    ADVANCE: { bg: 'from-purple-500 to-pink-500', icon: '🎉' },
    PRACTICE_PREREQ: { bg: 'from-amber-500 to-orange-600', icon: '📚' },
  }

  const c = config[rec.type] ?? config.KEEP

  return (
    <div className={`mb-8 rounded-2xl bg-gradient-to-r ${c.bg} p-6 text-white shadow-lg`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-2xl">{c.icon}</span>
            <span className="text-sm font-medium uppercase tracking-wide opacity-80">
              系統推薦
            </span>
          </div>
          <p className="text-lg font-bold">{rec.reason}</p>
        </div>
        {rec.skillId && (
          <Link
            href={`/practice/${childId}`}
            className="inline-block whitespace-nowrap rounded-xl bg-white/20 px-5 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/30"
          >
            開始練習 →
          </Link>
        )}
      </div>
    </div>
  )
}

// ============ 主頁面 ============
export default async function ChildOverviewPage({
  params,
}: {
  params: Promise<{ childId: string }>
}) {
  const { childId } = await params

  // 權限檢查：支援家長 session 或孩子 session
  const auth = await getOverviewAuth()
  if (!auth) redirect('/login')

  // 家長：可查看自己建立或透過 ParentChild 綁定的孩子
  // 孩子（自主學習）：只能查看自己的檔案（childId 必須等於 session 中的 childId）
  const child = auth.type === 'parent'
    ? await prisma.childProfile.findFirst({
        where: {
          id: childId,
          OR: [
            { parentId: auth.userId },
            { parentLinks: { some: { parentId: auth.userId } } },
          ],
        },
        include: {
          sessions: {
            orderBy: { startedAt: 'desc' },
            take: 10,
            include: { skill: true },
          },
          badges: {
            include: { badge: true },
            orderBy: { earnedAt: 'desc' },
          },
        },
      })
    : auth.childId === childId
      ? await prisma.childProfile.findFirst({
          where: { id: childId },
          include: {
            sessions: {
              orderBy: { startedAt: 'desc' },
              take: 10,
              include: { skill: true },
            },
            badges: {
              include: { badge: true },
              orderBy: { earnedAt: 'desc' },
            },
          },
        })
      : null
  if (!child) notFound()

  const skillsData = await getChildSkills(childId)
  const lastSession = child.sessions[0]
  const isParent = auth.type === 'parent'
  const badges = await getChildBadges(childId)

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      {/* ============ 頂部導覽 ============ */}
      {isParent ? (
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 transition hover:text-neutral-900 dark:text-gray-400 dark:hover:text-white"
        >
          ← 返回孩子列表
        </Link>
      ) : (
        <Link
          href={`/practice/${childId}`}
          className="inline-flex items-center gap-1 text-sm text-neutral-500 transition hover:text-neutral-900 dark:text-gray-400 dark:hover:text-white"
        >
          ← 返回練習選單
        </Link>
      )}

      {/* ============ 孩子資訊 ============ */}
      <div className="mt-3 mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-4xl dark:bg-blue-950">
            🧒
          </span>
          <div>
            <h1 className="text-2xl font-bold">{child.nickname}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-500 dark:text-gray-400">
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                {gradeLabel(child.gradeLevel)}
              </span>
              {/* 家長可調整孩子年級 */}
              {isParent && (
                <GradeSelector childId={child.id} currentGrade={child.gradeLevel} />
              )}
              {lastSession ? (
                <span>上次練習 {relativeTime(lastSession.startedAt)}</span>
              ) : (
                <span>尚未開始練習</span>
              )}
            </div>
            {/* 遊戲化資訊 */}
            <div className="mt-2 flex items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1 text-amber-600" title="累計星星數">
                ⭐ {child.stars}
              </span>
              {child.streak > 0 && (
                <span className="inline-flex items-center gap-1 text-orange-600" title="連續練習天數">
                  🔥 連續 {child.streak} 天
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/practice/${childId}`}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
          >
            開始新練習
          </Link>
          {/* 匯出資料（CSV）：家長可下載孩子的完整練習紀錄（GDPR 資料可攜權） */}
          <a
            href={`/api/export/child/${childId}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium transition hover:bg-neutral-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
            title="下載完整練習紀錄（CSV，可用 Excel 開啟）"
          >
            📥 匯出資料
          </a>
        </div>
      </div>

      {/* ============ 功能導覽頁籤（僅家長可見） ============ */}
      {isParent && (
        <nav className="mb-8 flex flex-wrap gap-2">
          <Link
            href={`/children/${childId}/report`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-blue-800 dark:hover:text-blue-400"
          >
            📊 成長報告
          </Link>
          <Link
            href={`/children/${childId}/review`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:border-red-200 hover:text-red-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-red-800 dark:hover:text-red-400"
          >
            📝 錯題本
          </Link>
          <Link
            href={`/children/${childId}/history`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-indigo-800 dark:hover:text-indigo-400"
          >
            📋 練習歷史
          </Link>
        </nav>
      )}

      {/* ============ 系統推薦 ============ */}
      {skillsData?.recommendation && (
        <RecommendationBanner rec={skillsData.recommendation} childId={childId} />
      )}

      {/* ============ 技能掌握度 ============ */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">技能掌握度</h2>

        {!skillsData || skillsData.skills.every((s) => s.recentTotal === 0) ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-3 text-5xl">📝</div>
            <p className="mb-1 text-lg font-medium text-neutral-700 dark:text-gray-200">
              還沒有練習紀錄
            </p>
            <p className="mb-5 text-sm text-neutral-400 dark:text-gray-500">
              開始第一次練習吧！
            </p>
            <Link
              href={`/practice/${childId}`}
              className="inline-block rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              開始練習 →
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {skillsData.skills.map((skill) => {
              const pct = skill.recentTotal > 0
                ? Math.round(skill.masteryLevel * 100)
                : 0
              const hasData = skill.recentTotal > 0

              let colorClass: string
              let statusLabel: string
              let barColor: string
              if (!hasData) {
                colorClass = 'border-neutral-200 dark:border-gray-700'
                statusLabel = '未練習'
                barColor = 'bg-neutral-300 dark:bg-gray-600'
              } else if (pct >= 95) {
                colorClass = 'border-green-200 bg-green-50/50'
                statusLabel = '✅ 已掌握'
                barColor = 'bg-green-500'
              } else if (pct >= 60) {
                colorClass = 'border-amber-200 bg-amber-50/50'
                statusLabel = '🟡 練習中'
                barColor = 'bg-amber-500'
              } else {
                colorClass = 'border-red-200 bg-red-50/50'
                statusLabel = '🔴 需加強'
                barColor = 'bg-red-500'
              }

              return (
                <div
                  key={skill.id}
                  className={`rounded-xl border ${colorClass} bg-white p-5 shadow-sm transition hover:shadow dark:bg-gray-900`}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold">{skill.name}</h3>
                      {skill.description && (
                        <p className="mt-0.5 truncate text-xs text-neutral-400 dark:text-gray-500">
                          {skill.description}
                        </p>
                      )}
                    </div>
                    <span className="ml-2 shrink-0 text-xs font-medium">
                      {statusLabel}
                    </span>
                  </div>

                  {hasData && (
                    <>
                      <div className="mb-1 flex justify-between text-xs text-neutral-500 dark:text-gray-400">
                        <span>
                          最近 {skill.recentTotal} 題答對 {skill.recentCorrect} 題
                        </span>
                        <span className="font-bold">{pct}%</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-gray-700">
                        <div
                          className={`h-full rounded-full transition-all ${barColor}`}
                          style={{ width: `${Math.max(pct, 4)}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ============ 成就徽章 ============ */}
      <section className="mb-10">
        <AchievementBadges badges={badges} />
        <div className="mt-4 text-center">
          <Link
            href={`/achievements/${childId}`}
            className="inline-block rounded-lg border border-neutral-300 px-5 py-2 text-sm font-medium transition hover:bg-neutral-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
          >
            查看全部成就 🏅
          </Link>
        </div>
      </section>

      {/* ============ 最近練習紀錄 ============ */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">最近練習紀錄</h2>

        {child.sessions.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-2 text-4xl">📋</div>
            <p className="text-sm text-neutral-400 dark:text-gray-500">尚無練習紀錄</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-medium uppercase tracking-wider text-neutral-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  <th className="px-4 py-3 pl-5">時間</th>
                  <th className="px-4 py-3">技能</th>
                  <th className="px-4 py-3">作答</th>
                  <th className="px-4 py-3 text-right pr-5">狀態</th>
                </tr>
              </thead>
              <tbody>
                {child.sessions.map((s) => {
                  const correctRate =
                    s.totalQuestions > 0
                      ? Math.round((s.correctCount / s.totalQuestions) * 100)
                      : 0
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50/50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 pl-5 text-neutral-400 dark:text-gray-500">
                        {relativeTime(s.startedAt)}
                      </td>
                      <td className="px-4 py-3 font-medium">{s.skill.name}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-neutral-800 dark:text-gray-100">
                          {s.correctCount}/{s.totalQuestions}
                        </span>
                        <span
                          className={`ml-1.5 text-xs ${
                            correctRate >= 60
                              ? 'text-green-500'
                              : correctRate > 0
                                ? 'text-amber-500'
                                : 'text-red-500'
                          }`}
                        >
                          ({correctRate}%)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right pr-5">
                        {s.completedAt ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                            完成
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                            未完成
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ============ 底部操作 ============ */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/dashboard"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          ← 返回孩子列表
        </Link>
        <Link
          href={`/practice/${childId}`}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          開始新練習 →
        </Link>
      </div>
    </main>
  )
}
