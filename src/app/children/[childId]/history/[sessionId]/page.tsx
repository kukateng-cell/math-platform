import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getChildSession } from '@/lib/child-session'
import { prisma } from '@/lib/prisma'
import { displayAnswer } from '@/lib/answer-i18n'

export const dynamic = 'force-dynamic'

// ============ 授權 ============
type Auth = { type: 'parent'; userId: string } | { type: 'child'; childId: string } | null

async function getAuth(): Promise<Auth> {
  const s = await getSession()
  if (s) return { type: 'parent', userId: s.userId }
  const cs = await getChildSession()
  if (cs) return { type: 'child', childId: cs.childId }
  return null
}

async function canAccessChild(childId: string): Promise<boolean> {
  const auth = await getAuth()
  if (!auth) return false
  if (auth.type === 'child') return auth.childId === childId
  const child = await prisma.childProfile.findFirst({
    where: { id: childId, parentId: auth.userId },
  })
  if (child) return true
  const link = await prisma.parentChild.findFirst({
    where: { parentId: auth.userId, childId },
  })
  return !!link
}

function formatDuration(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000))
  if (sec < 60) return `${sec} 秒`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m} 分 ${s} 秒`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ childId: string; sessionId: string }>
}) {
  const { childId, sessionId } = await params

  const auth = await getAuth()
  if (!auth) redirect('/login')
  if (!(await canAccessChild(childId))) notFound()

  const session = await prisma.practiceSession.findUnique({
    where: { id: sessionId },
    include: {
      skill: true,
      child: { select: { nickname: true, gradeLevel: true } },
      attempts: {
        orderBy: { createdAt: 'asc' },
        include: {
          question: {
            select: {
              explanation: true,
              skill: { select: { name: true } },
            },
          },
        },
      },
    },
  })

  if (!session || session.childId !== childId) notFound()

  const totalQuestions = session.totalQuestions || session.attempts.length
  const correctCount = session.correctCount
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0

  // 按題型統計
  const typeStats = session.attempts.reduce(
    (acc, a) => {
      const type = detectQuestionType(a.questionPrompt)
      if (!acc[type]) acc[type] = { total: 0, correct: 0, wrong: 0, avgMs: 0, totalMs: 0 }
      acc[type].total++
      if (a.isCorrect) acc[type].correct++
      else acc[type].wrong++
      acc[type].totalMs += a.durationMs
      acc[type].avgMs = Math.round(acc[type].totalMs / acc[type].total)
      return acc
    },
    {} as Record<string, { total: number; correct: number; wrong: number; avgMs: number; totalMs: number }>
  )

  const totalDurationMs = session.attempts.reduce((sum, a) => sum + a.durationMs, 0)
  // 用時計算：從開始到完成，或各題累計
  const sessionDurationMs = session.completedAt
    ? session.completedAt.getTime() - session.startedAt.getTime()
    : totalDurationMs

  const isParent = auth.type === 'parent'

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      {/* 頂部導航 */}
      <Link
        href={isParent ? `/children/${childId}/history` : `/children/${childId}`}
        className="inline-flex items-center gap-1 text-sm text-neutral-500 transition hover:text-neutral-900 dark:text-gray-400 dark:hover:text-white"
      >
        ← {isParent ? '返回練習歷史' : '返回學習概覽'}
      </Link>

      {/* ============ 頁首資訊 ============ */}
      <div className="mt-3 mb-6">
        <h1 className="text-2xl font-bold">📋 練習詳情</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-500 dark:text-gray-400">
          <span className="font-medium text-neutral-700 dark:text-gray-200">{session.child.nickname}</span>
          <span>·</span>
          <span>{session.skill.name}</span>
          <span>·</span>
          <span>{formatDate(session.startedAt)}</span>
        </div>
      </div>

      {/* ============ 總覽卡片 ============ */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs text-neutral-400 dark:text-gray-500">正確率</p>
          <p className={`text-2xl font-bold ${
            accuracy >= 80 ? 'text-green-600' : accuracy >= 60 ? 'text-amber-600' : 'text-red-500'
          }`}>
            {accuracy}%
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs text-neutral-400 dark:text-gray-500">正確 / 總題數</p>
          <p className="text-2xl font-bold">
            {correctCount}
            <span className="text-sm font-normal text-neutral-400 dark:text-gray-500">/{totalQuestions}</span>
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs text-neutral-400 dark:text-gray-500">總用時</p>
          <p className="text-2xl font-bold">
            {Math.floor(sessionDurationMs / 60000)}
            <span className="text-sm font-normal text-neutral-400 dark:text-gray-500"> 分鐘</span>
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs text-neutral-400 dark:text-gray-500">平均每題</p>
          <p className="text-2xl font-bold">
            {totalQuestions > 0 ? Math.round(totalDurationMs / totalQuestions / 1000) : 0}
            <span className="text-sm font-normal text-neutral-400 dark:text-gray-500"> 秒</span>
          </p>
        </div>
      </div>

      {/* ============ 題型分析 ============ */}
      {Object.keys(typeStats).length > 1 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">題型分析</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(typeStats).map(([type, stats]) => {
              const typeAccuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
              return (
                <div
                  key={type}
                  className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium">{type}</span>
                    <span className={`text-sm font-bold ${
                      typeAccuracy >= 80 ? 'text-green-600' : typeAccuracy >= 60 ? 'text-amber-600' : 'text-red-500'
                    }`}>
                      {typeAccuracy}%
                    </span>
                  </div>
                  <div className="mb-2 flex gap-3 text-xs text-neutral-500 dark:text-gray-400">
                    <span>✅ {stats.correct} 題</span>
                    <span>❌ {stats.wrong} 題</span>
                    <span>⏱ 平均 {stats.avgMs / 1000} 秒</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-gray-700">
                    <div
                      className={`h-full rounded-full ${
                        typeAccuracy >= 80 ? 'bg-green-500' : typeAccuracy >= 60 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${typeAccuracy}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ============ 逐題詳情 ============ */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">
          逐題詳情
          <span className="ml-2 text-sm font-normal text-neutral-400 dark:text-gray-500">
            {session.attempts.length} 題
          </span>
        </h2>

        <div className="space-y-3">
          {session.attempts.map((a, idx) => (
            <div
              key={a.id}
              className={`rounded-xl border p-4 transition ${
                a.assisted
                  ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20'
                  : a.isCorrect
                    ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20'
                    : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-lg">
                  {a.assisted ? '🤝' : a.isCorrect ? '✅' : '❌'}
                </span>
                <div className="min-w-0 flex-1">
                  {/* 題目 */}
                  <div className="mb-2">
                    <span className="text-xs font-medium text-neutral-400 dark:text-gray-500">
                      第 {idx + 1} 題
                      {a.assisted && <span className="ml-2 text-amber-600 dark:text-amber-400">（家長協助）</span>}
                    </span>
                    <p className="mt-0.5 text-base font-medium">{a.questionPrompt}</p>
                  </div>

                  {/* 答案對比 */}
                  <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    <span>
                      <span className="text-neutral-500 dark:text-gray-400">你的答案：</span>
                      <span className={`font-semibold ${a.isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {displayAnswer(a.userAnswer)}
                      </span>
                    </span>
                    {!a.isCorrect && (
                      <span>
                        <span className="text-neutral-500 dark:text-gray-400">正確答案：</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          {displayAnswer(a.correctAnswer)}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* 中繼資料 */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400 dark:text-gray-500">
                    <span>⏱ {formatDuration(a.durationMs)}</span>
                    {/* 與平均比較 */}
                    {totalDurationMs > 0 && (
                      <span className={
                        a.durationMs > totalDurationMs / totalQuestions * 1.5
                          ? 'text-amber-600 dark:text-amber-400'
                          : ''
                      }>
                        {a.durationMs > totalDurationMs / totalQuestions * 1.5
                          ? '🟡 用時較長'
                          : '✅ 速度正常'}
                      </span>
                    )}
                  </div>

                  {/* 題目解析 */}
                  {a.question?.explanation && (
                    <div className="mt-2 rounded-lg bg-white/60 p-3 text-sm text-neutral-600 dark:bg-gray-900/60 dark:text-gray-300">
                      <span className="text-xs font-medium text-neutral-400 dark:text-gray-500">💡 解析：</span>
                      {a.question.explanation}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ 底部操作 ============ */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={isParent ? `/children/${childId}/history` : `/children/${childId}`}
          className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          ← 返回
        </Link>
        <Link
          href={`/practice/${childId}`}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          開始新練習 →
        </Link>
      </div>
    </main>
  )
}

// ============ 工具 ============
function detectQuestionType(prompt: string): string {
  if (prompt.includes('×') || prompt.includes('x') || prompt.includes('乘')) return '乘法'
  if (prompt.includes('÷') || prompt.includes('除') || prompt.includes('分')) return '除法'
  if (prompt.includes('+') || prompt.includes('加')) return '加法'
  if (prompt.includes('-') || prompt.includes('減') || prompt.includes('减')) return '減法'
  return '其他'
}
