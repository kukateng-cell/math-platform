import Link from 'next/link'
import { getCurrentUser } from '@/actions/auth'
import { prisma } from '@/lib/prisma'
import AddChildForm from '@/components/add-child-form'
import DeleteChildButton from '@/components/delete-child-button'

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

  const children = await prisma.childProfile.findMany({
    where: { parentId: user.id },
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
  })

  // 技能總數（用於計算掌握進度百分比）
  const totalSkills = await prisma.skill.count({ where: { isActive: true } })

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">我的孩子</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">
          建立孩子檔案後，點「開始練習」即可陪孩子一起做題
        </p>
      </div>

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
                    <span className="text-xl sm:text-2xl">🧒</span>
                    <span className="text-base font-semibold sm:text-lg">{child.nickname}</span>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                    {child.gradeLevel === 'K' ? '幼兒園' : `${child.gradeLevel.replace('G', '')}年級`}
                  </span>
                </div>

                {/* 遊戲化資訊 */}
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="inline-flex items-center gap-1 text-amber-600" title="累計星星數">
                    ⭐ {child.stars}
                  </span>
                  {child.streak > 0 && (
                    <span className="inline-flex items-center gap-1 text-orange-600" title="連續練習天數">
                      🔥 連續 {child.streak} 天
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-neutral-500 dark:text-gray-400" title="累計練習次數">
                    📚 {child._count.sessions} 次
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
