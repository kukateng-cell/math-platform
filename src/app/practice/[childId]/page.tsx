import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getChildSkills, startSession, hasPracticeAccess, checkPromotionEligibility, startPromotionTest } from '@/actions/practice'
import { getSession } from '@/lib/session'
import { childLogout } from '@/actions/child-auth'
import { getChildBadges } from '@/actions/achievement'
import { SkillFolders } from '@/components/skill-folders'
import AchievementBadges from '@/components/achievement-badges'

export default async function PracticeSelectPage({
  params,
}: {
  params: Promise<{ childId: string }>
}) {
  const { childId } = await params
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

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
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

      {/* 技能列表（依年級分類成資料夾）*/}
      <h2 className="mb-3 mt-2 text-lg font-semibold">依年級選擇練習</h2>
      <SkillFolders
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
