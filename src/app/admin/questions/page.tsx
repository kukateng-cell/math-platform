import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { toggleQuestion } from '@/actions/admin'
import QuestionForm from '@/components/admin/question-form'
import QuestionActions from '@/components/admin/question-actions'
import SkillFilter from '@/components/admin/skill-filter'

const TYPE_LABEL: Record<string, string> = {
  DIRECT: '直接',
  ADD: '加法',
  SUB: '減法',
  MUL: '乘法',
  DIV: '除法',
  WORD_PROBLEM: '文字題',
}

const CATEGORY_LABEL: Record<string, string> = {
  GENERAL: '一般',
  WITHIN_10000: '萬以內加減',
  FRACTION: '分數運算',
  MULTI_DIGIT_MUL: '多位數乘法',
  PERIMETER_AREA: '周長與面積',
  DECIMAL: '小數運算',
  ONE_DIGIT_DIV: '一位數除法',
}

const CATEGORY_ICON: Record<string, string> = {
  GENERAL: '📦',
  WITHIN_10000: '🔢',
  FRACTION: '🍕',
  MULTI_DIGIT_MUL: '✖️',
  PERIMETER_AREA: '📐',
  DECIMAL: '🔟',
  ONE_DIGIT_DIV: '➗',
}

const PAGE_SIZE = 20

export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; skillId?: string; category?: string; page?: string }>
}) {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') redirect('/dashboard')

  const { q, skillId, category: catParam, page: pageStr } = await searchParams
  const query = q?.trim() || ''
  const filterSkillId = skillId?.trim() || ''
  const filterCategory = catParam?.trim() || ''
  const page = Math.max(1, parseInt(pageStr || '1', 10) || 1)

  // 技能列表（供表單與篩選用）
  const skills = await prisma.skill.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } })
  const skillOptions = skills.map((s) => ({ id: s.id, name: s.name }))

  // 題目查詢（含搜尋與篩選）
  const where: Record<string, unknown> = {}
  if (query) {
    where.prompt = { contains: query }
  }
  if (filterSkillId) {
    where.skillId = filterSkillId
  }
  if (filterCategory) {
    where.category = filterCategory
  }

  const [total, questions] = await Promise.all([
    prisma.questionTemplate.count({ where }),
    prisma.questionTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { skill: true },
    }),

  const [total, questions] = await Promise.all([
    prisma.questionTemplate.count({ where }),
    prisma.questionTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { skill: true },
    }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // 分頁 URL helper
  function pageUrl(p: number) {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (filterSkillId) params.set('skillId', filterSkillId)
    if (filterCategory) params.set('category', filterCategory)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return `/admin/questions${qs ? `?${qs}` : ''}`
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <Link href="/admin" className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-gray-400 dark:hover:text-white">
        ← 返回後台
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold">題目管理</h1>

      {/* 新增表單 */}
      <div className="mb-8 rounded-xl border border-neutral-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-4 font-semibold">新增題目</h2>
        <QuestionForm mode="create" skills={skillOptions} />
      </div>

      {/* 搜尋與篩選 */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs font-medium text-neutral-500 dark:text-gray-400">搜尋題目</label>
          <form className="flex gap-2">
            <input
              name="q"
              defaultValue={query}
              placeholder="輸入題目關鍵字…"
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
            <input type="hidden" name="page" value="1" />
            <button
              type="submit"
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
            >
              🔍
            </button>
            {query && (
              <a
                href={pageUrl(1).replace(/\bq=[^&]*&?/g, '').replace(/[?&]$/, '') || '/admin/questions'}
                className="rounded-lg px-3 py-2 text-sm text-neutral-400 hover:text-neutral-700 dark:text-gray-500 dark:hover:text-gray-300"
              >
                ✕ 清除
              </a>
            )}
          </form>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-500 dark:text-gray-400">技能篩選</label>
          <SkillFilter
            skills={skills}
            defaultValue={filterSkillId}
            query={query}
            category={filterCategory}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-500 dark:text-gray-400">題目分類</label>
          <form>
            <input type="hidden" name="q" value={query} />
            <input type="hidden" name="skillId" value={filterSkillId} />
            <input type="hidden" name="page" value="1" />
            <select
              name="category"
              defaultValue={filterCategory}
              onChange={(e) => (e.target.form as HTMLFormElement)?.requestSubmit()}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="">全部分類</option>
              <option value="WITHIN_10000">🔢 萬以內加減</option>
              <option value="FRACTION">🍕 分數運算</option>
              <option value="MULTI_DIGIT_MUL">✖️ 多位數乘法</option>
              <option value="PERIMETER_AREA">📐 周長與面積</option>
              <option value="DECIMAL">🔟 小數運算</option>
              <option value="ONE_DIGIT_DIV">➗ 一位數除法</option>
            </select>
            {filterCategory && (
              <a
                href={pageUrl(1).replace(/category=[^&]*&?/g, '').replace(/[?&]$/, '') || '/admin/questions'}
                className="ml-1 text-xs text-neutral-400 hover:text-neutral-700 dark:text-gray-500 dark:hover:text-gray-300"
              >
                ✕
              </a>
            )}
          </form>
        </div>
      </div>

      {/* 題目列表標題 */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">
          現有題目（{total}）
          {(query || filterSkillId) && (
            <span className="ml-1 text-sm font-normal text-neutral-400 dark:text-gray-500">— 已篩選</span>
          )}
        </h2>
        {totalPages > 1 && (
          <span className="text-xs text-neutral-400 dark:text-gray-500">
            第 {page} / {totalPages} 頁
          </span>
        )}
      </div>

      {/* 題目列表 */}
      {questions.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-neutral-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500">
          {query || filterSkillId ? '沒有符合條件的題目' : '尚無題目'}
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q) => (
            <div
              key={q.id}
              className={`flex items-center justify-between rounded-lg border bg-white px-4 py-3 dark:bg-gray-900 ${
                q.isActive ? 'border-neutral-200 dark:border-gray-700' : 'border-neutral-200 opacity-60 dark:border-gray-700'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-neutral-100 px-1.5 text-xs text-neutral-600 dark:bg-gray-700 dark:text-gray-300">
                    {TYPE_LABEL[q.type] ?? q.type}
                  </span>
                  {(q as Record<string, string>).category && (q as Record<string, string>).category !== 'GENERAL' && (
                    <span className="rounded bg-blue-50 px-1.5 text-xs text-blue-600 dark:bg-blue-950 dark:text-blue-400" title={CATEGORY_LABEL[(q as Record<string, string>).category] ?? ''}>
                      {CATEGORY_ICON[(q as Record<string, string>).category] ?? ''} {CATEGORY_LABEL[(q as Record<string, string>).category] ?? (q as Record<string, string>).category}
                    </span>
                  )}
                  <span className="truncate font-medium">{q.prompt}</span>
                  {!q.isActive && (
                    <span className="rounded-full bg-red-50 px-2 text-xs text-red-500">已停用</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-neutral-400 dark:text-gray-500">
                  {q.skill.name} · 答案 {q.answer}
                  {q.explanation ? ` · 💡 ${q.explanation.slice(0, 30)}${q.explanation.length > 30 ? '…' : ''}` : ''}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <QuestionActions
                  question={{
                    id: q.id,
                    skillId: q.skillId,
                    type: q.type,
                    prompt: q.prompt,
                    answer: q.answer,
                    options: q.options,
                    paramsJson: q.paramsJson,
                    explanation: q.explanation,
                  }}
                  skills={skillOptions}
                />

                <form action={toggleQuestion}>
                  <input type="hidden" name="id" value={q.id} />
                  <button
                    type="submit"
                    className={`whitespace-nowrap rounded px-3 py-1 text-xs font-medium ${
                      q.isActive ? 'text-red-500 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {q.isActive ? '停用' : '啟用'}
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分頁控制 */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          {page > 1 ? (
            <Link
              href={pageUrl(page - 1)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
            >
              ← 上一頁
            </Link>
          ) : (
            <span className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-300 dark:border-gray-700 dark:text-gray-600">
              ← 上一頁
            </span>
          )}

          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={pageUrl(p)}
                className={`rounded px-3 py-1.5 text-sm ${
                  p === page
                    ? 'bg-blue-600 font-medium text-white'
                    : 'text-neutral-600 hover:bg-neutral-100 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                {p}
              </Link>
            ))}
          </div>

          {page < totalPages ? (
            <Link
              href={pageUrl(page + 1)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
            >
              下一頁 →
            </Link>
          ) : (
            <span className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-300 dark:border-gray-700 dark:text-gray-600">
              下一頁 →
            </span>
          )}
        </div>
      )}
    </main>
  )
}
