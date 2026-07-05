import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getChildSession } from '@/lib/child-session'
import { getWrongQuestions, type WrongQuestionGroup } from '@/actions/reports'

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
  return true // parent check done in reports action
}

function gradeLabel(level: string): string {
  const map: Record<string, string> = { K: '幼兒園', G1: '一年級', G2: '二年級', G3: '三年級', G4: '四年級', G5: '五年級', G6: '六年級' }
  return map[level] ?? level
}

// ============ 主頁面 ============
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ childId: string }>
}) {
  const { childId } = await params
  const auth = await getAuth()
  if (!auth) redirect('/login')
  if (!(await canAccess(childId))) notFound()

  const groups = await getWrongQuestions(childId, 5)
  if (!groups) notFound()

  const totalWrong = groups.reduce((sum, g) => sum + g.items.length, 0)

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      {/* 頂部導航 */}
      <Link
        href={`/children/${childId}`}
        className="inline-flex items-center gap-1 text-sm text-neutral-500 transition hover:text-neutral-900 dark:text-gray-400 dark:hover:text-white"
      >
        ← 返回學習概覽
      </Link>

      <div className="mt-3 mb-8">
        <h1 className="text-2xl font-bold">📝 錯題本</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">
          彙整練習中答錯的題目，幫助針對性複習
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 text-6xl">🎉</div>
          <h2 className="mb-1 text-lg font-semibold">沒有錯題紀錄</h2>
          <p className="text-sm text-neutral-400 dark:text-gray-500">
            所有答錯的題目都會自動彙整到這裡，方便複習
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 總覽統計 */}
          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-xs text-neutral-500 dark:text-gray-400">需複習的技能</p>
              <p className="text-xl font-bold">{groups.length}</p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-xs text-neutral-500 dark:text-gray-400">錯題總數</p>
              <p className="text-xl font-bold">{totalWrong}</p>
            </div>
          </div>

          {/* 按技能分組的錯題 */}
          {groups.map((group) => (
            <WrongSkillGroup key={group.skillId} group={group} childId={childId} />
          ))}
        </div>
      )}
    </main>
  )
}

// ============ 單個技能的錯題區塊 ============
function WrongSkillGroup({
  group,
  childId,
}: {
  group: WrongQuestionGroup
  childId: string
}) {
  const masteryPct = Math.round(group.masteryLevel * 100)

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* 技能標頭 */}
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4 dark:border-gray-700">
        <div>
          <h2 className="font-semibold">{group.skillName}</h2>
          <p className="text-xs text-neutral-400 dark:text-gray-500">
            {gradeLabel(group.gradeLevel)} · 掌握度 {masteryPct}%
          </p>
        </div>
        <Link
          href={`/practice/${childId}`}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
        >
          複習此技能
        </Link>
      </div>

      {/* 錯題列表 */}
      <div className="divide-y divide-neutral-100 dark:divide-gray-800">
        {group.items.map((item) => (
          <div key={item.id} className="px-5 py-4 transition hover:bg-neutral-50/50 dark:hover:bg-gray-800/30">
            <div className="mb-2 flex items-start justify-between gap-3">
              <p className="flex-1 text-sm leading-relaxed">{item.questionPrompt}</p>
              <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-950 dark:text-red-400">
                錯 {item.wrongCount} 次
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="text-red-500">
                你的答案：<span className="font-medium line-through">{item.userAnswer}</span>
              </span>
              <span className="text-green-600">
                正確答案：<span className="font-semibold">{item.correctAnswer}</span>
              </span>
              <span className="text-neutral-400 dark:text-gray-500">
                用時 {(item.durationMs / 1000).toFixed(1)} 秒
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
