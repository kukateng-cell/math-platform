import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getChildSession } from '@/lib/child-session'
import { prisma } from '@/lib/prisma'
import { getChildBadges } from '@/actions/achievement'
import AchievementBadges from '@/components/achievement-badges'
import { Icon } from '@/components/icon'

// ============ 授權輔助（與孩子頁一致）============
type AchAuth =
  | { type: 'parent'; userId: string }
  | { type: 'child'; childId: string }
  | null

async function getAuth(): Promise<AchAuth> {
  const session = await getSession()
  if (session) return { type: 'parent', userId: session.userId }
  const childSession = await getChildSession()
  if (childSession) return { type: 'child', childId: childSession.childId }
  return null
}

export default async function AchievementsPage({
  params,
}: {
  params: Promise<{ childId: string }>
}) {
  const { childId } = await params

  const auth = await getAuth()
  if (!auth) redirect('/login')

  // 家長：可檢視自己建立或綁定的孩子（綁定須為 ACTIVE）
  // 孩子：只能看自己
  const child = auth.type === 'parent'
    ? await prisma.childProfile.findFirst({
        where: {
          id: childId,
          OR: [
            { parentId: auth.userId },
            { parentLinks: { some: { parentId: auth.userId, status: 'ACTIVE' } } },
          ],
        },
      })
    : auth.childId === childId
      ? await prisma.childProfile.findUnique({ where: { id: childId } })
      : null
  if (!child) notFound()

  const isParent = auth.type === 'parent'
  const badges = await getChildBadges(childId)
  const earnedCount = badges.filter((b) => b.earned).length

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      {/* 導覽 */}
      {isParent ? (
        <Link
          href={`/children/${childId}`}
          className="inline-flex items-center gap-1 text-sm text-neutral-500 transition hover:text-neutral-900 dark:text-gray-400 dark:hover:text-white"
        >
          ← 返回 {child.nickname} 的學習概覽
        </Link>
      ) : (
        <Link
          href={`/practice/${childId}`}
          className="inline-flex items-center gap-1 text-sm text-neutral-500 transition hover:text-neutral-900 dark:text-gray-400 dark:hover:text-white"
        >
          ← 返回練習選單
        </Link>
      )}

      {/* 頁首 */}
      <div className="mt-4 mb-8 flex flex-col items-center gap-3 border-b border-neutral-200 pb-6 text-center dark:border-gray-700">
        <span className="text-amber-500"><Icon name="medal" className="h-12 w-12" /></span>
        <h1 className="text-2xl font-bold">{child.nickname} 的成就徽章</h1>
        <p className="text-sm text-neutral-500 dark:text-gray-400">
          已獲得 {earnedCount} / {badges.length} 個徽章
        </p>
        {/* 總進度條 */}
        <div className="w-full max-w-sm">
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all"
              style={{ width: `${badges.length > 0 ? Math.round((earnedCount / badges.length) * 100) : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* 星星 + 連續天數 */}
      <div className="mb-8 flex justify-center gap-6 text-sm">
        <span className="inline-flex items-center gap-1 text-amber-600" title="累計星星數">
          <Icon name="star" className="h-4 w-4" /> {child.stars}
        </span>
        {child.streak > 0 && (
          <span className="inline-flex items-center gap-1 text-orange-600" title="連續練習天數">
            <Icon name="fire" className="h-4 w-4" />連續 {child.streak} 天
          </span>
        )}
      </div>

      {/* 徽章完整列表 */}
      <AchievementBadges badges={badges} />
    </main>
  )
}
