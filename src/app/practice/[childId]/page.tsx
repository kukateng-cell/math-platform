import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getChildSkills, startSession, hasPracticeAccess, checkPromotionEligibility, startPromotionTest, startChallengePractice, getResumeableSessions } from '@/actions/practice'
import { getSession } from '@/lib/session'
import { childLogout } from '@/actions/child-auth'
import { getChildBadges } from '@/actions/achievement'
import { SkillTree } from '@/components/skill-tree'
import AchievementBadges from '@/components/achievement-badges'

export default async function PracticeSelectPage({
  params,
  searchParams,
}: {
  params: Promise<{ childId: string }>
  searchParams?: Promise<{ error?: string; info?: string }>
}) {
  const { childId } = await params
  const { error, info } = (await searchParams) ?? {}
  // 練習路由支援家長 session 或孩子 session
  const hasAccess = await hasPracticeAccess()
  if (!hasAccess) return null

  // 判斷目前身分：家長可返回孩子列表，孩子則顯示登出
  const parentSession = await getSession()
  const isParent = !!parentSession

  const data = await getChildSkills(childId)
  if (!data) notFound()

  const { child, skills, recommendation } = data

  // 檢查升學資格
  const promotion = await checkPromotionEligibility(childId)

  // 成就徽章
  const badges = await getChildBadges(childId)

  // 斷點續做：查詢今天未完成的練習（可繼續）
  const resumeable = await getResumeableSessions(childId)

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 lg:max-w-4xl">
      <div className="mb-6">
        {isParent ? (
          <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-gray-400 dark:hover:text-white">
            ← 返回孩子列表
          </Link>
        ) : (
          <form action={childLogout}>
            <button type="submit" className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-gray-400 dark:hover:text-white">
              ← 登出
            </button>
          </form>
        )}
        <h1 className="mt-2 text-2xl font-bold">
          {child.nickname} 的練習選單
        </h1>
      </div>

      {/* 升學測試提示 */}
      {promotion.eligible && promotion.nextGrade && (
        <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 p-5 text-white shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-2xl">🎓</span>
                <span className="text-sm font-medium uppercase tracking-wide opacity-90">升學測試</span>
              </div>
              <p className="font-bold">
                已掌握 {promotion.currentGrade} 的所有內容！<br />
                參加升學測試來挑戰 {promotion.nextGrade}
              </p>
            </div>
            <form action={startPromotionTest.bind(null, childId)}>
              <button
                type="submit"
                className="whitespace-nowrap rounded-xl bg-white/20 px-5 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/30"
              >
                開始測試 →
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 推薦區 */}
      {recommendation.skillId && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">💡 系統建議</p>
              <p className="mt-1 text-sm text-blue-900 dark:text-blue-200">{recommendation.reason}</p>
            </div>
            {recommendation.type !== 'ALL_DONE' && (
              <form action={startSession.bind(null, childId, recommendation.skillId)}>
                <button
                  type="submit"
                  className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  建議練習 →
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 提示訊息（從 redirect 帶回） */}
      {error === 'no_challenge' && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
            ⚡ 目前沒有可用的提升練習題，請聯繫管理員
          </p>
        </div>
      )}
      {info === 'already_completed' && (
        <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-800 dark:bg-sky-950">
          <p className="text-sm font-medium text-sky-700 dark:text-sky-300">
            ℹ️ 此練習已在其他裝置完成，請選擇新的練習
          </p>
        </div>
      )}

      {/* 斷點續做：繼續未完成的練習 */}
      {resumeable.length > 0 && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-5 dark:border-emerald-800 dark:from-emerald-950/50 dark:to-teal-950/50">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-2xl">▶️</span>
            <span className="text-sm font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">繼續上次練習</span>
          </div>
          <div className="space-y-2">
            {resumeable.map((s) => {
              const pct = Math.round((s.answeredCount / s.totalQuestions) * 100)
              return (
                <Link
                  key={s.sessionId}
                  href={`/practice/${childId}/${s.skillId}/${s.sessionId}`}
                  className="flex items-center justify-between gap-4 rounded-xl bg-white/70 p-4 transition hover:bg-white dark:bg-gray-800/70 dark:hover:bg-gray-800"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-neutral-800 dark:text-gray-100">
                      {s.skillName}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-neutral-200 dark:bg-gray-700">
                        <div
                          className="h-2 rounded-full bg-emerald-500 transition-all"
                          style={{ width: pct + '%' }}
                        />
                      </div>
                      <span className="whitespace-nowrap text-xs text-neutral-500 dark:text-gray-400">
                        剩 {s.remainingCount} 題
                      </span>
                    </div>
                  </div>
                  <span className="whitespace-nowrap rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                    繼續 →
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* 提升練習（挑戰） */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-5 dark:border-orange-800 dark:from-orange-950/50 dark:to-amber-950/50">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <span className="text-sm font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">提升練習</span>
              <span className="rounded-full bg-orange-200 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-800 dark:text-orange-300">挑戰</span>
            </div>
            <p className="text-sm text-neutral-600 dark:text-gray-300">
              跨技能綜合應用題，挑戰自己的極限！<br />
              <span className="text-xs text-neutral-400 dark:text-gray-500">不影響掌握度與升學，純粹挑戰自我 💪</span>
            </p>
          </div>
          <form action={startChallengePractice.bind(null, childId)}>
            <button
              type="submit"
              className="whitespace-nowrap rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:from-orange-600 hover:to-amber-600 active:scale-95"
            >
              開始挑戰 →
            </button>
          </form>
        </div>
      </div>

      {/* 技能樹 */}
      <div className="mb-2 mt-2 text-center">
        <p className="text-sm text-neutral-500 dark:text-gray-400">🌳 點擊年級節點展開技能樹</p>
      </div>
      <SkillTree
        skills={skills}
        childId={childId}
        childGradeLevel={child.gradeLevel}
      />

      {/* 成就徽章（簡潔模式） */}
      <div className="mt-8">
        <AchievementBadges badges={badges} compact />
        {badges.some((b) => b.earned) && (
          <div className="mt-3 text-center">
            <Link
              href={`/achievements/${childId}`}
              className="text-xs font-medium text-neutral-500 underline underline-offset-2 transition hover:text-neutral-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              查看全部成就 🏅
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
