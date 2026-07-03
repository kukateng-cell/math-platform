import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { createBadge, updateBadge, deleteBadge } from '@/actions/admin'
import BadgeForm from './badge-form'

export default async function AdminBadgesPage() {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') redirect('/dashboard')

  const badges = await prisma.badge.findMany({
    orderBy: { code: 'asc' },
    include: { _count: { select: { childBadges: true } } },
  })

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <Link href="/admin" className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-gray-400 dark:hover:text-white">
        ← 返回後台
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold">成就徽章管理</h1>

      {/* 新增表單 */}
      <div className="mb-8 rounded-xl border border-neutral-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-4 font-semibold">新增徽章</h2>
        <BadgeForm mode="create" />
      </div>

      {/* 徽章列表 */}
      <h2 className="mb-3 font-semibold">
        現有徽章（{badges.length}）
      </h2>
      <div className="space-y-2">
        {badges.map((badge) => (
          <div
            key={badge.id}
            className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{badge.icon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{badge.name}</span>
                  <code className="rounded bg-neutral-100 px-1.5 text-xs text-neutral-500 dark:bg-gray-700 dark:text-gray-400">{badge.code}</code>
                </div>
                <p className="mt-0.5 text-xs text-neutral-400 dark:text-gray-500">{badge.condition}</p>
                <p className="text-xs text-blue-500">{badge._count.childBadges} 個孩子已獲得</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <BadgeForm mode="edit" badge={{ id: badge.id, name: badge.name, icon: badge.icon, condition: badge.condition }} />
              <form action={deleteBadge}>
                <input type="hidden" name="id" value={badge.id} />
                <button
                  type="submit"
                  className="rounded px-3 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                  onClick={(e) => { if (!confirm('確定刪除此徽章？所有孩子獲得的此徽章紀錄也將一併刪除。')) e.preventDefault() }}
                >
                  🗑️ 刪除
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
