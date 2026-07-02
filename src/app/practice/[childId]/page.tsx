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

      {/* 技能列表 */}
      <div className="space-y-3">
        {skills.map((skill) => {
          const rate = skill.recentTotal > 0 ? Math.round(skill.masteryLevel * 100) : null
          return (
            <div
              key={skill.id}
              className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{skill.name}</h3>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-gray-700 dark:text-gray-300">
                    {skill.gradeLevel}
                  </span>
                  {skill.questionCount === 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                      尚無題目
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-neutral-600 dark:text-gray-400">{skill.description}</p>
                {rate !== null && (
                  <p className="mt-1 text-xs text-neutral-400 dark:text-gray-500">
                    最近正確率 {rate}%（{skill.recentCorrect}/{skill.recentTotal}）
                  </p>
                )}
              </div>
              {skill.questionCount > 0 ? (
                <form action={startSession.bind(null, childId, skill.id)}>
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                  >
                    練習
                  </button>
                </form>
              ) : (
                <span className="text-sm text-neutral-400 dark:text-gray-500">無題目</span>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
