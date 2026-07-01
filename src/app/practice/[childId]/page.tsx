import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getChildSkills, startSession } from '@/actions/practice'
import { getCurrentUser } from '@/actions/auth'

export default async function PracticeSelectPage({
  params,
}: {
  params: Promise<{ childId: string }>
}) {
  const { childId } = await params
  const user = await getCurrentUser()
  if (!user) return null

  const data = await getChildSkills(childId)
  if (!data) notFound()

  const { child, skills, recommendation } = data

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← 返回孩子列表
        </Link>
        <h1 className="mt-2 text-2xl font-bold">
          {child.nickname} 的練習選單
        </h1>
      </div>

      {/* 推薦區 */}
      {recommendation.skillId && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-blue-700">💡 系統建議</p>
              <p className="mt-1 text-sm text-blue-900">{recommendation.reason}</p>
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
              className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{skill.name}</h3>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                    {skill.gradeLevel}
                  </span>
                  {skill.questionCount === 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                      尚無題目
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-neutral-600">{skill.description}</p>
                {rate !== null && (
                  <p className="mt-1 text-xs text-neutral-400">
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
                <span className="text-sm text-neutral-400">無題目</span>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
