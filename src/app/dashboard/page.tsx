import Link from 'next/link'
import { getCurrentUser } from '@/actions/auth'
import { getPendingLinkRequests } from '@/actions/student-auth'
import { prisma } from '@/lib/prisma'
import { accessibleGrades } from '@/lib/grade'
import AddChildForm from '@/components/add-child-form'
import DeleteChildButton from '@/components/delete-child-button'
import PendingLinkRequests from '@/components/pending-link-requests'
import { Icon } from '@/components/icon'

// 相對時間
function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return '剛剛'
  if (mins < 60) return `${mins} 分鐘前`
  if (hours < 24) return `${hours} 小時前`
  if (days < 7) return `${days} 天前`
  return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) return null

  // 平行載入孩子列表與綁定請求（彼此獨立）
  const [children, pendingRequests] = await Promise.all([
    // 列出家長自己建立的孩子，以及「已確認綁定」的學生（學生主動綁定須家長確認）
    // PENDING 綁定尚未生效，不會出現在這裡（另列於下方「綁定請求」區塊）
    prisma.childProfile.findMany({
      where: {
        OR: [
          { parentId: user.id },
          { parentLinks: { some: { parentId: user.id, status: 'ACTIVE' } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sessions: {
          orderBy: { startedAt: 'desc' },
          take: 5,
          where: { completedAt: { not: null } },
        },
        masterySnapshots: true,
        _count: { select: { sessions: { where: { completedAt: { not: null } } } } },
      },
    }),
    // 待家長確認的綁定請求（學生主動綁定）
    getPendingLinkRequests(),
  ])

  // 每個年級的啟用技能數（一次查出，供每個孩子依其年級計算可接觸範圍內的技能數）
  // 掌握進度的分母必須是「孩子可接觸年級範圍（K..當前年級）」的技能數，
  // 而非全年級（K~G6）。否則低年級孩子即使練完自己年級的全部技能，
  // 進度也會顯示很低（例如 K 的 3 個技能 / 47 個全年級 = 6%）。
  const skillCountByGrade = await prisma.skill.groupBy({
    by: ['gradeLevel'],
    where: { isActive: true },
    _count: true,
  })
  const skillCountMap = new Map(skillCountByGrade.map((g) => [g.gradeLevel, g._count]))
  // reachableSkills(gradeLevel)：給定孩子年級，回傳其可接觸年級（含自身及以下）的技能總數
  function reachableSkills(gradeLevel: string): number {
    return accessibleGrades(gradeLevel).reduce(
      (sum, g) => sum + (skillCountMap.get(g) ?? 0),
      0
    )
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Icon name="thumbs-up" className="h-8 w-8 text-blue-500" />歡迎回來，{user.name}</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">
            建立孩子檔案後，點「開始練習」即可陪孩子一起做題
          </p>
        </div>
        <Link
          href="/dashboard/settings"
          className="shrink-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium transition hover:bg-neutral-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
        >
          <Icon name="wrench" className="h-4 w-4" />帳號設定
        </Link>
      </div>

      {/* 待確認的綁定請求（學生主動綁定家長） */}
      {pendingRequests.length > 0 && (
        <PendingLinkRequests requests={pendingRequests} />
      )}

      {children.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
          <p className="mb-4 text-neutral-600 dark:text-gray-300">還沒有建立任何孩子檔案</p>
          <div className="mx-auto max-w-xs">
            <AddChildForm />
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {children.map((child) => {
            const lastSession = child.sessions[0]
            const practicedSkills = child.masterySnapshots.filter((m) => m.recentTotal > 0).length
            const masteredSkills = child.masterySnapshots.filter(
              (m) => m.recentTotal > 0 && m.masteryLevel >= 0.95
            ).length
            // 掌握進度的分母：僅計孩子可接觸年級範圍內的技能數（與授予邏輯一致）
            const totalSkills = reachableSkills(child.gradeLevel)
            const skillPct = totalSkills > 0 ? Math.round((masteredSkills / totalSkills) * 100) : 0

            // 最近 5 次練習的平均正確率
            const recentSessions = child.sessions.slice(0, 5)
            const avgAccuracy = recentSessions.length > 0
              ? Math.round(
                  (recentSessions.reduce(
                    (sum, s) => sum + (s.totalQuestions > 0 ? s.correctCount / s.totalQuestions : 0),
                    0
                  ) / recentSessions.length) * 100
                )
              : null

            return (
              <div
                key={child.id}
                className="flex flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-900 sm:p-5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="student" className="h-8 w-8 shrink-0 rounded-xl bg-blue-100 p-1.5 text-blue-600 dark:bg-blue-950 dark:text-blue-400" />
                    <span className="text-base font-semibold sm:text-lg">{child.nickname}</span>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                    {child.gradeLevel === 'K' ? '幼兒園' : `${child.gradeLevel.replace('G', '')}年級`}
                  </span>
                </div>

                {/* 遊戲化資訊 */}
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="inline-flex items-center gap-1 text-amber-600" title="累計星星數">
                    <Icon name="star" className="h-4 w-4" />{child.stars}
                  </span>
                  {child.streak > 0 && (
                    <span className="inline-flex items-center gap-1 text-orange-600" title="連續練習天數">
                      <Icon name="fire" className="h-4 w-4" />連續 {child.streak} 天
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-neutral-500 dark:text-gray-400" title="累計練習次數">
                    <Icon name="books" className="h-4 w-4" />{child._count.sessions} 次
                  </span>
                </div>

                {/* 技能掌握進度 */}
                {practicedSkills > 0 && (
                  <div className="mb-3 rounded-lg bg-neutral-50 p-2.5 dark:bg-gray-800">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-neutral-600 dark:text-gray-300">
                        技能掌握 {skillPct}%
                      </span>
                      <span className="text-neutral-400 dark:text-gray-500">
                        {masteredSkills}/{totalSkills} 已掌握
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-gray-700">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all"
                        style={{ width: `${Math.max(skillPct, 3)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 最近練習資訊 */}
                {lastSession ? (
                  <div className="mb-3 space-y-0.5 text-xs text-neutral-500 dark:text-gray-400 sm:text-sm">
                    <p>
                      上次練習：<span className="font-medium text-neutral-700 dark:text-gray-200">{lastSession.correctCount}/{lastSession.totalQuestions} 題正確</span>
                      <span className="ml-1 text-neutral-400 dark:text-gray-500">（{relativeTime(lastSession.startedAt)}）</span>
                    </p>
                    {avgAccuracy !== null && (
                      <p>
                        近 {recentSessions.length} 次平均正確率：<span className={`font-medium ${avgAccuracy >= 80 ? 'text-green-600' : avgAccuracy >= 60 ? 'text-amber-600' : 'text-red-500'}`}>{avgAccuracy}%</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mb-3 text-sm text-neutral-400 dark:text-gray-500">尚未練習</p>
                )}

                <div className="mt-auto flex flex-col gap-2">
                  <Link
                    href={`/practice/${child.id}`}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-blue-700"
                  >
                    開始練習 →
                  </Link>
                  <Link
                    href={`/children/${child.id}`}
                    className="rounded-lg border border-neutral-300 px-4 py-2 text-center text-sm transition hover:bg-neutral-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
                  >
                    學習概覽
                  </Link>
                  {/* 學習報表快捷入口 */}
                  <div className="grid grid-cols-3 gap-1">
                    <Link
                      href={`/children/${child.id}/report`}
                      className="rounded-md border border-neutral-200 px-2 py-1.5 text-center text-xs text-neutral-500 transition hover:bg-blue-50 hover:text-blue-600 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-blue-950 dark:hover:text-blue-400"
                      title="成長報告"
                    >
                      <Icon name="note" className="h-4 w-4" />報告
                    </Link>
                    <Link
                      href={`/children/${child.id}/review`}
                      className="rounded-md border border-neutral-200 px-2 py-1.5 text-center text-xs text-neutral-500 transition hover:bg-red-50 hover:text-red-600 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-red-950 dark:hover:text-red-400"
                      title="錯題本"
                    >
                      <Icon name="pencil" className="h-4 w-4" />錯題
                    </Link>
                    <Link
                      href={`/children/${child.id}/history`}
                      className="rounded-md border border-neutral-200 px-2 py-1.5 text-center text-xs text-neutral-500 transition hover:bg-indigo-50 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-indigo-950 dark:hover:text-indigo-400"
                      title="練習歷史"
                    >
                      <Icon name="clock" className="h-4 w-4" />歷史
                    </Link>
                  </div>
                  <DeleteChildButton childId={child.id} nickname={child.nickname} />
                </div>
              </div>
            )
          })}

          <div className="flex items-center justify-center">
            <AddChildForm />
          </div>
        </div>
      )}
    </main>
  )
}
