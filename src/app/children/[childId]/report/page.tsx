import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getChildSession } from '@/lib/child-session'
import { getGrowthReport, type GrowthReport } from '@/actions/reports'

// ============ 授權 ============
type Auth = { type: 'parent'; userId: string } | { type: 'child'; childId: string } | null

async function getAuth(): Promise<Auth> {
  const s = await getSession()
  if (s) return { type: 'parent', userId: s.userId }
  const cs = await getChildSession()
  if (cs) return { type: 'child', childId: cs.childId }
  return null
}

async function canAccess(childId: string): Promise<boolean> {
  const auth = await getAuth()
  if (!auth) return false
  if (auth.type === 'child') return auth.childId === childId
  return true
}

function gradeLabel(level: string): string {
  const map: Record<string, string> = { K: '幼兒園', G1: '一年級', G2: '二年級', G3: '三年級', G4: '四年級', G5: '五年級', G6: '六年級' }
  return map[level] ?? level
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ childId: string }>
  searchParams: Promise<{ days?: string }>
}) {
  const { childId } = await params
  const sp = await searchParams
  const days = Math.min(Math.max(parseInt(sp.days ?? '30', 10) || 30, 7), 90)

  const auth = await getAuth()
  if (!auth) redirect('/login')
  if (!(await canAccess(childId))) notFound()

  const report = await getGrowthReport(childId, days)
  if (!report) notFound()

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      {/* 頂部導航 */}
      <Link
        href={`/children/${childId}`}
        className="inline-flex items-center gap-1 text-sm text-neutral-500 transition hover:text-neutral-900 dark:text-gray-400 dark:hover:text-white"
      >
        ← 返回學習概覽
      </Link>

      <div className="mt-3 mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">📊 成長報告</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">
            {report.child.nickname} · {gradeLabel(report.child.gradeLevel)}
          </p>
        </div>

        {/* 時間區間切換 */}
        <div className="flex gap-1 rounded-lg border border-neutral-200 bg-white p-0.5 dark:border-gray-700 dark:bg-gray-900">
          {[7, 30, 90].map((d) => (
            <Link
              key={d}
              href={`/children/${childId}/report?days=${d}`}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                days === d
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-neutral-600 hover:bg-neutral-100 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}
            >
              {d === 7 ? '近 7 天' : d === 30 ? '近 30 天' : '近 90 天'}
            </Link>
          ))}
        </div>
      </div>

      {/* ============ 總覽卡片 ============ */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="練習次數" value={report.summary.totalSessions} unit="次" icon="📚" />
        <SummaryCard label="答題總數" value={report.summary.totalQuestions} unit="題" icon="✏️" />
        <SummaryCard
          label="正確率"
          value={report.summary.accuracy}
          unit="%"
          icon="🎯"
          highlight={report.summary.accuracy >= 80 ? 'text-green-600' : report.summary.accuracy >= 60 ? 'text-amber-600' : 'text-red-500'}
        />
        <SummaryCard label="練習時長" value={report.summary.totalPracticeMin} unit="分鐘" icon="⏱️" />
      </div>

      {/* ============ 遊戲化摘要 ============ */}
      <div className="mb-8 flex flex-wrap gap-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-xs text-amber-600 dark:text-amber-400">累計星星</p>
          <p className="text-xl font-bold text-amber-700 dark:text-amber-300">⭐ {report.child.stars}</p>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50/50 px-4 py-3 dark:border-orange-800 dark:bg-orange-950/30">
          <p className="text-xs text-orange-600 dark:text-orange-400">連續天數</p>
          <p className="text-xl font-bold text-orange-700 dark:text-orange-300">🔥 {report.child.streak} 天</p>
        </div>
      </div>

      {/* ============ 每日趨勢圖 ============ */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">每日練習趨勢</h2>
        <DailyTrendChart data={report.dailyTrend} />
      </section>

      {/* ============ 技能表現 ============ */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">各技能表現</h2>
        {report.skillBreakdown.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-neutral-400 dark:text-gray-500">尚無技能練習數據</p>
          </div>
        ) : (
          <div className="space-y-3">
            {report.skillBreakdown.map((skill) => (
              <SkillBar key={skill.skillId} skill={skill} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

// ============ 總覽卡片 ============
function SummaryCard({
  label,
  value,
  unit,
  icon,
  highlight,
}: {
  label: string
  value: number
  unit: string
  icon: string
  highlight?: string
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <p className="mb-1 text-xs text-neutral-400 dark:text-gray-500">
        {icon} {label}
      </p>
      <p className={`text-2xl font-bold ${highlight ?? 'text-neutral-900 dark:text-white'}`}>
        {value}
        <span className="ml-0.5 text-sm font-normal text-neutral-400 dark:text-gray-500">{unit}</span>
      </p>
    </div>
  )
}

// ============ 每日趨勢圖（純 CSS 長條圖）============
function DailyTrendChart({ data }: { data: GrowthReport['dailyTrend'] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
        <p className="text-sm text-neutral-400 dark:text-gray-500">區間內尚無數據</p>
      </div>
    )
  }

  const maxQuestions = Math.max(...data.map((d) => d.questions), 1)
  // 只顯示部分日期標籤（避免太擠）
  const step = Math.max(1, Math.floor(data.length / 10))

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* 長條圖區 */}
      <div className="flex items-end gap-[2px] sm:gap-[3px]" style={{ height: 180 }}>
        {data.map((day) => {
          const h = day.questions > 0 ? (day.questions / maxQuestions) * 100 : 0
          return (
            <div
              key={day.date}
              className="group relative flex flex-1 flex-col items-center justify-end"
              style={{ height: '100%' }}
            >
              {/* 工具提示 */}
              <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-md bg-neutral-800 px-2 py-1 text-xs text-white shadow-lg group-hover:block dark:bg-neutral-700">
                <p className="whitespace-nowrap">{day.date}</p>
                <p>答題 {day.questions} 題 · 正確率 {day.accuracy}%</p>
                <p>練習 {day.sessions} 次 · {day.durationMin} 分鐘</p>
              </div>
              {/* 長條 */}
              <div
                className={`w-full rounded-t transition-all hover:opacity-80 ${
                  day.accuracy >= 80
                    ? 'bg-green-400'
                    : day.accuracy >= 60
                      ? 'bg-amber-400'
                      : day.questions > 0
                        ? 'bg-red-400'
                        : 'bg-neutral-100 dark:bg-gray-700'
                }`}
                style={{ height: `${Math.max(h, day.questions > 0 ? 4 : 2)}%`, minHeight: day.questions > 0 ? 4 : 2 }}
              />
            </div>
          )
        })}
      </div>

      {/* X 軸日期標籤 */}
      <div className="mt-2 flex gap-[2px] sm:gap-[3px]">
        {data.map((day, i) => (
          <div
            key={day.date}
            className="flex-1 text-center"
          >
            {i % step === 0 && (
              <span className="text-[10px] text-neutral-400 dark:text-gray-500">
                {day.date.slice(5)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============ 技能掌握度橫條 ============
function SkillBar({
  skill,
}: {
  skill: GrowthReport['skillBreakdown'][number]
}) {
  const colorClass =
    skill.masteryLevel >= 95
      ? 'bg-green-500'
      : skill.masteryLevel >= 60
        ? 'bg-amber-500'
        : 'bg-red-500'

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="font-medium">{skill.skillName}</p>
          <p className="text-xs text-neutral-400 dark:text-gray-500">
            {gradeLabel(skill.gradeLevel)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">{skill.accuracy}%</p>
          <p className="text-xs text-neutral-400 dark:text-gray-500">
            {skill.recentCorrect}/{skill.recentTotal} 題
          </p>
        </div>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-gray-700">
        <div
          className={`h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${Math.max(skill.masteryLevel, 3)}%` }}
        />
      </div>
    </div>
  )
}
