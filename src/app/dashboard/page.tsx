import Link from 'next/link'
import { getCurrentUser } from '@/actions/auth'
import { prisma } from '@/lib/prisma'
import AddChildForm from '@/components/add-child-form'
import DeleteChildButton from '@/components/delete-child-button'
import ChildPinManager from '@/components/child-pin-manager'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const children = await prisma.childProfile.findMany({
    where: { parentId: user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      sessions: {
        orderBy: { startedAt: 'desc' },
        take: 1,
      },
    },
  })

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">我的孩子</h1>
        <Link
          href="/child-login"
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          🧒 孩子練習模式
        </Link>
      </div>

      {children.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
          <p className="mb-4 text-neutral-600 dark:text-gray-300">還沒有建立任何孩子檔案</p>
          <div className="mx-auto max-w-xs">
            <AddChildForm />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {children.map((child) => (
            <div
              key={child.id}
              className="flex flex-col rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🧒</span>
                  <span className="text-lg font-semibold">{child.nickname}</span>
                </div>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  {child.gradeLevel === 'K' ? '幼兒園' : `${child.gradeLevel.replace('G', '')}年級`}
                </span>
              </div>

              {/* 遊戲化資訊：星星 + 連續天數 */}
              <div className="mb-2 flex items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1 text-amber-600" title="累計星星數">
                  ⭐ {child.stars}
                </span>
                {child.streak > 0 && (
                  <span className="inline-flex items-center gap-1 text-orange-600" title="連續練習天數">
                    🔥 連續 {child.streak} 天
                  </span>
                )}
              </div>

              {child.sessions[0] ? (
                <p className="mb-3 text-sm text-neutral-500 dark:text-gray-400">
                  上次練習：{child.sessions[0].correctCount}/{child.sessions[0].totalQuestions} 題正確
                </p>
              ) : (
                <p className="mb-3 text-sm text-neutral-400 dark:text-gray-500">尚未練習</p>
              )}

              <Link
                href={`/practice/${child.id}`}
                className="mb-2 rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-blue-700"
              >
                開始練習 →
              </Link>
              <Link
                href={`/children/${child.id}`}
                className="mb-2 rounded-lg border border-neutral-300 px-4 py-2 text-center text-sm transition hover:bg-neutral-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
              >
                學習概覽
              </Link>
              <div className="mb-2">
                <ChildPinManager childId={child.id} currentPin={child.pin ?? null} />
              </div>
              <DeleteChildButton childId={child.id} nickname={child.nickname} />
            </div>
          ))}

          <div className="flex items-center justify-center">
            <AddChildForm />
          </div>
        </div>
      )}
    </main>
  )
}
