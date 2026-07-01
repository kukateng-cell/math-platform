import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { toggleQuestion } from '@/actions/admin'
import QuestionForm from '@/components/admin/question-form'

const TYPE_LABEL: Record<string, string> = {
  DIRECT: '直接',
  ADD: '加法',
  SUB: '減法',
}

export default async function AdminQuestionsPage() {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') redirect('/dashboard')

  const [skills, questions] = await Promise.all([
    prisma.skill.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
    prisma.questionTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      include: { skill: true },
    }),
  ])

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <Link href="/admin" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← 返回後台
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold">題目管理</h1>

      <div className="mb-8 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-4 font-semibold">新增題目</h2>
        <QuestionForm skills={skills.map((s) => ({ id: s.id, name: s.name }))} />
      </div>

      <h2 className="mb-3 font-semibold">現有題目（{questions.length}）</h2>
      <div className="space-y-2">
        {questions.map((q) => (
          <div
            key={q.id}
            className={`flex items-center justify-between rounded-lg border bg-white px-4 py-3 ${
              q.isActive ? 'border-neutral-200' : 'border-neutral-200 opacity-60'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded bg-neutral-100 px-1.5 text-xs text-neutral-600">
                  {TYPE_LABEL[q.type]}
                </span>
                <span className="truncate font-medium">{q.prompt}</span>
              </div>
              <p className="mt-0.5 text-xs text-neutral-400">
                {q.skill.name} · 答案 {q.answer}
              </p>
            </div>
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
        ))}
      </div>
    </main>
  )
}
