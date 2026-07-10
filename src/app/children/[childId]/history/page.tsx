import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPracticeHistory } from '@/actions/reports'
import { displayAnswer } from '@/lib/answer-i18n'

export const dynamic = 'force-dynamic'

function formatDuration(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000))
  if (sec < 60) return `${sec} 秒`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m} 分 ${s} 秒`
}

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

export default async function PracticeHistoryPage({
  params,
}: {
  params: Promise<{ childId: string }>
}) {
  const { childId } = await params
  const history = await getPracticeHistory(childId, 30)

  if (!history) notFound()

  return (
    <main className="home-bg mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <Link
        href={`/children/${childId}`}
        className="inline-flex items-center gap-1 text-sm text-neutral-500 transition hover:text-neutral-900 dark:text-gray-400 dark:hover:text-white"
      >
        ← 返回學習概覽
      </Link>

      {/* 頁首 */}
      <div className="mt-3 mb-6 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📋</span>
          <div>
            <h1 className="text-2xl font-bold">練習歷史</h1>
            <p className="text-sm text-white/90">最近 {history.length} 次練習的逐題詳情</p>
          </div>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 text-5xl">📭</div>
          <p className="text-lg font-medium text-neutral-700 dark:text-gray-200">還沒有練習紀錄</p>
          <p className="mt-1 text-sm text-neutral-400 dark:text-gray-500">完成第一次練習後，這裡會顯示逐題詳情</p>
          <Link
            href={`/practice/${childId}`}
            className="mt-5 inline-block rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            開始練習 →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((session) => {
            // P2-4：分母用 gradedQuestionCount（排除 assisted 題）
            const graded = session.gradedQuestionCount || session.totalQuestions
            const accuracy =
              graded > 0
                ? Math.round((session.correctCount / graded) * 100)
                : 0
            const accColor =
              accuracy >= 80
                ? 'text-green-600 dark:text-green-400'
                : accuracy >= 60
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400'

            return (
              <details
                key={session.id}
                className="group rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:shadow dark:border-gray-700 dark:bg-gray-900"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold">{session.skillName}</h3>
                      <span className={`text-sm font-bold ${accColor}`}>{accuracy}%</span>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500 dark:text-gray-400">
                      {relativeTime(session.startedAt)} · 答對 {session.correctCount}/{session.totalQuestions} 題 · 平均 {session.avgDurationSec} 秒/題
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/children/${childId}/history/${session.id}`}
                      className="rounded-md bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400 dark:hover:bg-blue-900"
                    >
                      查看詳情 →
                    </Link>
                    <span className="shrink-0 text-neutral-400 transition group-open:rotate-90 dark:text-gray-500">
                      ▶
                    </span>
                  </div>
                </summary>

                {/* 逐題詳情 */}
                <div className="border-t border-neutral-100 p-4 dark:border-gray-800 sm:p-5">
                  <ol className="space-y-2">
                    {session.attempts.map((a, idx) => (
                      <li
                        key={a.id}
                        className={`flex items-start gap-3 rounded-xl p-3 text-sm ${
                          a.assisted
                            ? 'bg-amber-50 dark:bg-amber-950/40'
                            : a.isCorrect
                            ? 'bg-green-50 dark:bg-green-950/40'
                            : 'bg-red-50 dark:bg-red-950/40'
                        }`}
                      >
                        <span className="shrink-0 text-base">
                          {a.assisted ? '🤝' : a.isCorrect ? '✅' : '❌'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-neutral-800 dark:text-gray-200">
                            <span className="text-neutral-400 dark:text-gray-500">第 {idx + 1} 題：</span>
                            {a.questionPrompt}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-neutral-500 dark:text-gray-400">
                            <span>
                              你的答案：<span className={a.isCorrect ? 'font-medium text-green-600 dark:text-green-400' : 'font-medium text-red-600 dark:text-red-400'}>{displayAnswer(a.userAnswer)}</span>
                            </span>
                            {!a.isCorrect && (
                              <span>
                                正確答案：<span className="font-medium text-green-600 dark:text-green-400">{displayAnswer(a.correctAnswer)}</span>
                              </span>
                            )}
                            <span>用時 {formatDuration(a.durationMs)}</span>
                            {a.assisted && <span className="font-medium text-amber-600 dark:text-amber-400">家長協助（不計成績）</span>}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </details>
            )
          })}
        </div>
      )}
    </main>
  )
}
