import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/actions/auth'
import { prisma } from '@/lib/prisma'
import { getChildSkills } from '@/actions/practice'

export default async function ChildOverviewPage({
  params,
}: {
  params: Promise<{ childId: string }>
}) {
  const { childId } = await params
  const user = await getCurrentUser()
  if (!user) return null

  const child = await prisma.childProfile.findFirst({
    where: { id: childId, parentId: user.id },
    include: {
      sessions: {
        orderBy: { startedAt: 'desc' },
        take: 10,
        include: { skill: true },
      },
    },
  })
  if (!child) notFound()

  const skillsData = await getChildSkills(childId)

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← 返回孩子列表
      </Link>

      <div className="mt-2 mb-8 flex items-center gap-3">
        <span className="text-4xl">🧒</span>
        <div>
          <h1 className="text-2xl font-bold">{child.nickname}</h1>
          <p className="text-sm text-neutral-500">
            {child.gradeLevel === 'K' ? '幼兒園' : `${child.gradeLevel.replace('G', '')}年級`}
          </p>
        </div>
      </div>

      {/* 推薦 */}
      {skillsData?.recommendation && (
        <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-700">💡 下一步建議</p>
          <p className="mt-1 text-blue-900">{skillsData.recommendation.reason}</p>
        </div>
      )}

      {/* 技能掌握度 */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">技能掌握度</h2>
        <div className="space-y-3">
          {skillsData?.skills.map((skill) => {
            const pct = skill.recentTotal > 0 ? Math.round(skill.masteryLevel * 100) : 0
            return (
              <div key={skill.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="mb-1 flex justify-between">
                  <span className="font-medium">{skill.name}</span>
                  <span className="text-sm text-neutral-500">
                    {skill.recentTotal > 0 ? `${pct}%` : '未練習'}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-neutral-200">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-blue-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 最近練習 */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">最近練習紀錄</h2>
        {child.sessions.length === 0 ? (
          <p className="rounded-xl border border-neutral-200 bg-white p-6 text-center text-neutral-400">
            尚未練習
          </p>
        ) : (
          <div className="space-y-2">
            {child.sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                <div>
                  <span className="font-medium">{s.skill.name}</span>
                  <span className="ml-2 text-neutral-400">
                    {new Date(s.startedAt).toLocaleDateString('zh-TW')}
                  </span>
                </div>
                <span className={s.completedAt ? 'text-green-600' : 'text-amber-500'}>
                  {s.completedAt
                    ? `${s.correctCount}/${s.totalQuestions} 正確`
                    : '未完成'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
