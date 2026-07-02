import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { toggleSkill } from '@/actions/admin'
import SkillForm from '@/components/admin/skill-form'
import SkillActions from '@/components/admin/skill-actions'

export default async function AdminSkillsPage() {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') redirect('/dashboard')

  const skills = await prisma.skill.findMany({
    orderBy: { order: 'asc' },
    include: {
      prerequisite: true,
      dependents: { select: { id: true, name: true } },
      _count: { select: { questions: { where: { isActive: true } } } },
    },
  })

  const skillOptions = skills.map((s) => ({ id: s.id, name: s.name }))

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <Link href="/admin" className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-gray-400 dark:hover:text-white">
        ← 返回後台
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold">技能管理</h1>

      <div className="mb-8 rounded-xl border border-neutral-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-4 font-semibold">新增技能</h2>
        <SkillForm mode="create" skills={skillOptions} />
      </div>

      <h2 className="mb-3 font-semibold">現有技能（{skills.length}）</h2>
      <div className="space-y-2">
        {skills.map((s, i) => (
          <div
            key={s.id}
            className={`flex items-center justify-between rounded-lg border bg-white px-4 py-3 dark:bg-gray-900 ${
              s.isActive ? 'border-neutral-200 dark:border-gray-700' : 'border-neutral-200 opacity-60 dark:border-gray-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <SkillActions
                skill={{
                  id: s.id,
                  code: s.code,
                  name: s.name,
                  description: s.description,
                  gradeLevel: s.gradeLevel,
                  order: s.order,
                  isActive: s.isActive,
                  prerequisiteId: s.prerequisiteId,
                  prerequisite: s.prerequisite ? { id: s.prerequisite.id, name: s.prerequisite.name } : null,
                  _count: { questions: s._count.questions },
                  dependents: s.dependents,
                }}
                allSkills={skillOptions}
                isFirst={i === 0}
                isLast={i === skills.length - 1}
              />

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  <code className="rounded bg-neutral-100 px-1.5 text-xs text-neutral-500 dark:bg-gray-700 dark:text-gray-400">{s.code}</code>
                  <span className="rounded-full bg-blue-50 px-2 text-xs text-blue-600 dark:bg-blue-950 dark:text-blue-400">{s.gradeLevel}</span>
                  {!s.isActive && (
                    <span className="rounded-full bg-red-50 px-2 text-xs text-red-500">已停用</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-neutral-400 dark:text-gray-500">
                  {`${s._count.questions} 題`}
                  {s.prerequisite ? ` · 前置：${s.prerequisite.name}` : ''}
                </p>
              </div>
            </div>

            <form action={toggleSkill}>
              <input type="hidden" name="id" value={s.id} />
              <button
                type="submit"
                className={`rounded px-3 py-1 text-xs font-medium ${
                  s.isActive ? 'text-red-500 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                }`}
              >
                {s.isActive ? '停用' : '啟用'}
              </button>
            </form>
          </div>
        ))}
      </div>
    </main>
  )
}
