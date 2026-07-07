import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/actions/auth'
import { getAdminStats } from '@/actions/admin'
import { Icon } from '@/components/icon'

export default async function AdminPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') redirect('/dashboard')

  const stats = await getAdminStats()

  const cards = [
    { label: '技能', value: stats.skills, href: '/admin/skills', icon: 'target' },
    { label: '啟用題目', value: stats.questions, href: '/admin/questions', icon: 'pencil' },
    { label: '作答紀錄', value: stats.attempts, href: '/admin/attempts', icon: 'note' },
    { label: '孩子檔案', value: stats.children, href: '/admin/children', icon: 'student' },
    { label: '成就徽章', value: stats.badges, href: '/admin/badges', icon: 'medal' },
  ]

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">管理後台</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-500"
          >
            <div className="mb-2 text-blue-600 dark:text-blue-400"><Icon name={c.icon as any} className="h-8 w-8" /></div>
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-sm text-neutral-500 dark:text-gray-400">{c.label}</div>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/skills"
          className="rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-blue-300 dark:border-gray-700 dark:bg-gray-900"
        >
          <h3 className="flex items-center gap-1.5 font-semibold"><Icon name="target" className="h-4 w-4" />技能管理</h3>
          <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">新增、修改、停用技能與前置關係</p>
        </Link>
        <Link
          href="/admin/questions"
          className="rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-blue-300 dark:border-gray-700 dark:bg-gray-900"
        >
          <h3 className="flex items-center gap-1.5 font-semibold"><Icon name="pencil" className="h-4 w-4" />題目管理</h3>
          <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">新增題目、參數化模板、停用問題題目</p>
        </Link>
        <Link
          href="/admin/children"
          className="rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-blue-300 dark:border-gray-700 dark:bg-gray-900"
        >
          <h3 className="flex items-center gap-1.5 font-semibold"><Icon name="student" className="h-4 w-4" />孩子總覽</h3>
          <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">查看所有孩子的練習狀況、掌握度與進度</p>
        </Link>
        <Link
          href="/admin/badges"
          className="rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-blue-300 dark:border-gray-700 dark:bg-gray-900"
        >
          <h3 className="flex items-center gap-1.5 font-semibold"><Icon name="medal" className="h-4 w-4" />成就徽章</h3>
          <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">新增、編輯、刪除成就徽章定義</p>
        </Link>
      </div>
    </main>
  )
}
