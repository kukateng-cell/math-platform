import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getWrongQuestions } from '@/actions/reports'
import { displayAnswer } from '@/lib/answer-i18n'

export const dynamic = 'force-dynamic'

function relativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return '剛剛'
  if (mins < 60) return `${mins} 分鐘前`
  if (hours < 24) return `${hours} 小時前`
  if (days < 7) return `${days} 天前`
  return d.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })
}

export default async function WrongQuestionsPage({
  params,
}: {
  params: Promise<{ childId: string }>
}) {
  const { childId } = await params
  const groups = await getWrongQuestions(childId, 5)

  if (!groups) notFound()

  const totalWrong = groups.reduce((sum, g) => sum + g.items.length, 0)

  return (
    <main className="home-bg mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <Link
        href={`/children/${childId}`}
        className="inline-flex items-center gap-1 text-sm text-neutral-500 transition hover:text-neutral-900 dark:text-gray-400 dark:hover:text-white"
      >
        ← 返回學習概覽
      </Link>

      {/* 頁首 */}
      <div className="mt-3 mb-6 rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📓</span>
          <div>
            <h1 className="text-2xl font-bold">錯題本</h1>
            <p className="text-sm text-white/90">
              共 {groups.length} 個技能、{totalWrong} 題待複習 · 按掌握度由低到高排列
            </p>
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 text-5xl">🎉</div>
          <p className="text-lg font-medium text-neutral-700 dark:text-gray-200">目前沒有錯題！</p>
          <p className="mt-1 text-sm text-neutral-400 dark:text-gray-500">答錯的題目會自動收集到這裡，方便針對性複習</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => {
            const masteryPct = Math.round(group.masteryLevel * 100)
            return (
              <section
                key={group.skillId}
                className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
              >
                {/* 技能標頭 */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 p-4 dark:border-gray-800 sm:p-5">
                  <div>
                    <h2 className="font-bold">{group.skillName}</h2>
                    <p className="mt-0.5 text-xs text-neutral-500 dark:text-gray-400">
                      {group.gradeLevel} · {group.items.length} 題錯題
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-neutral-400 dark:text-gray-500">掌握度</div>
                    <div className={`text-lg font-bold ${masteryPct >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                      {masteryPct}%
                    </div>
                  </div>
                </div>

                {/* 錯題列表 */}
                <ol className="divide-y divide-neutral-100 dark:divide-gray-800">
                  {group.items.map((item) => (
                    <li key={item.id} className="flex items-start gap-3 p-4 dark:p-5">
                      <span className="shrink-0 rounded-lg bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600 dark:bg-red-950 dark:text-red-400">
                        錯 {item.wrongCount} 次
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-neutral-800 dark:text-gray-200">{item.questionPrompt}</p>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-neutral-500 dark:text-gray-400">
                          <span>
                            你的答案：<span className="font-medium text-red-600 dark:text-red-400">{displayAnswer(item.userAnswer)}</span>
                          </span>
                          <span>
                            正確答案：<span className="font-medium text-green-600 dark:text-green-400">{displayAnswer(item.correctAnswer)}</span>
                          </span>
                          <span>最近答錯：{relativeTime(item.lastWrongAt)}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>

                {/* 複習入口 */}
                <div className="border-t border-neutral-100 p-3 dark:border-gray-800">
                  <Link
                    href={`/practice/${childId}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-100 dark:bg-orange-950/50 dark:text-orange-300"
                  >
                    🔄 針對「{group.skillName}」再練一次 →
                  </Link>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </main>
  )
}
