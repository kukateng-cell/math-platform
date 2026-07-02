import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getChildSkills, startSession, hasPracticeAccess } from '@/actions/practice'
import { getSession } from '@/lib/session'
import { childLogout } from '@/actions/child-auth'

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

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-6 sm:px-4 sm:py-8">
      <div className="mb-5 sm:mb-6">
        {isParent ? (
          <Link href="/dashboard" className="text-xs text-neutral-500 hover:text-neutral-900 dark:text-gray-400 dark:hover:text-white sm:text-sm">
            ← 返回孩子列表
          </Link>
        ) : (
          <form action={childLogout}>
            <button type="submit" className="text-xs text-neutral-500 hover:text-neutral-900 dark:text-gray-400 dark:hover:text-white sm:text-sm">
              ← 登出
            </button>
          </form>
        )}
        <h1 className="mt-2 text-xl font-bold sm:text-2xl">
          {child.nickname} 的練習選單
        </h1>
      </div>

      {/* 推薦區 */}
      {recommendation.skillId && (
        <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950 sm:mb-6 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex-1">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300 sm:text-sm">💡 系統建議</p>
              <p className="mt-1 text-xs text-blue-900 dark:text-blue-200 sm:text-sm">{recommendation.reason}</p>
            </div>
            {recommendation.type !== 'ALL_DONE' && (
              <form action={startSession.bind(null, childId, recommendation.skillId)} className="shrink-0">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:w-auto"
                >
                  建議練習 →
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 技能列表 */}
      <div className="space-y-2 sm:space-y-3">
        {skills.map((skill) => {
          const rate = skill.recentTotal > 0 ? Math.round(skill.masteryLevel * 100) : null
          return (
            <div
              key={skill.id}
              className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between sm:p-4"
            >
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <h3 className="text-sm font-semibold sm:text-base">{skill.name}</h3>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-gray-700 dark:text-gray-300">
                    {skill.gradeLevel}
                  </span>
                  {skill.questionCount === 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                      尚無題目
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-neutral-600 dark:text-gray-400 sm:text-sm">{skill.description}</p>
                {rate !== null && (
                  <p className="mt-1 text-xs text-neutral-400 dark:text-gray-500">
                    最近正確率 {rate}%（{skill.recentCorrect}/{skill.recentTotal}）
                  </p>
                )}
              </div>
              <div className="shrink-0">
                {skill.questionCount > 0 ? (
                  <form action={startSession.bind(null, childId, skill.id)}>
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
                    >
                      練習
                    </button>
                  </form>
                ) : (
                  <span className="block text-center text-xs text-neutral-400 dark:text-gray-500 sm:text-sm">無題目</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}
