import Link from 'next/link'
import { getAllChildrenStats } from '@/actions/admin'
import { Icon } from '@/components/icon'

// 年級中文
function gradeLabel(level: string): string {
  const map: Record<string, string> = {
    K: '幼兒園',
    G1: '一年級',
    G2: '二年級',
    G3: '三年級',
    G4: '四年級',
    G5: '五年級',
    G6: '六年級',
  }
  return map[level] ?? level
}

// 相對時間
function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return '剛剛'
  if (mins < 60) return `${mins} 分鐘前`
  if (hours < 24) return `${hours} 小時前`
  if (days < 30) return `${days} 天前`
  return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })
}

export default async function AdminChildrenPage() {
  const children = await getAllChildrenStats()

  // ============ 平台彙總 ============
  const totalChildren = children.length
  const totalSessions = children.reduce((sum, c) => sum + c.sessionCount, 0)
  const activeChildren = children.filter((c) => c.lastPracticeAt).length
  const avgSkillPct =
    totalChildren > 0
      ? Math.round(children.reduce((sum, c) => sum + c.skillPct, 0) / totalChildren)
      : 0

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-gray-400 dark:hover:text-white"
      >
        ← 返回後台
      </Link>
      <div className="flex items-center justify-between gap-3">
        <h1 className="mt-2 text-2xl font-bold">所有孩子總覽</h1>
        {/* 匯出全部孩子的練習紀錄（CSV） */}
        <a
          href="/api/export/admin/all-children"
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium transition hover:bg-neutral-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
          title="下載全部孩子的練習紀錄（CSV，可用 Excel 開啟）"
        >
          <Icon name="download" className="h-4 w-4" />匯出全部資料
        </a>
      </div>

      {/* ============ 平台彙總卡片 ============ */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="text-2xl">{totalChildren}</div>
          <div className="text-xs text-neutral-500 dark:text-gray-400">孩子檔案總數</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="text-2xl">{activeChildren}</div>
          <div className="text-xs text-neutral-500 dark:text-gray-400">曾練習人數</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="text-2xl">{totalSessions}</div>
          <div className="text-xs text-neutral-500 dark:text-gray-400">累計練習次數</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="text-2xl">{avgSkillPct}%</div>
          <div className="text-xs text-neutral-500 dark:text-gray-400">平均掌握度</div>
        </div>
      </div>

      {/* ============ 孩子列表 ============ */}
      {children.length === 0 ? (
        <p className="rounded-xl border border-neutral-200 bg-white p-6 text-center text-neutral-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500">
          尚無任何孩子檔案
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">孩子</th>
                  <th className="px-4 py-3 font-medium">年級</th>
                  <th className="px-4 py-3 font-medium">歸屬家長</th>
                  <th className="px-4 py-3 font-medium">練習次數</th>
                  <th className="px-4 py-3 font-medium">技能掌握</th>
                  <th className="px-4 py-3 font-medium">近 5 次正確率</th>
                  <th className="px-4 py-3 font-medium">星星 / 連續</th>
                  <th className="px-4 py-3 font-medium">上次練習</th>
                </tr>
              </thead>
              <tbody>
                {children.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-neutral-100 last:border-0 dark:border-gray-800"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Icon name="student" className="h-8 w-8 shrink-0 rounded-full bg-blue-50 p-1.5 dark:bg-blue-950" />
                        <div>
                          <div className="font-medium">{c.nickname}</div>
                          {c.email && (
                            <div className="text-xs text-neutral-400 dark:text-gray-500">
                              {c.email}
                            </div>
                          )}
                          {c.mode === 'SELF_STUDY' && (
                            <span className="mt-0.5 inline-block rounded bg-purple-100 px-1 text-xs text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                              自主學習
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                        {gradeLabel(c.gradeLevel)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-gray-300">
                      {c.parent ? (
                        <div>
                          <div>{c.parent.name}</div>
                          <div className="text-xs text-neutral-400 dark:text-gray-500">
                            {c.parent.email}
                          </div>
                        </div>
                      ) : (
                        <span className="text-neutral-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.sessionCount > 0 ? (
                        <span className="font-medium">{c.sessionCount} 次</span>
                      ) : (
                        <span className="text-neutral-400 dark:text-gray-500">尚未練習</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.practicedSkills > 0 ? (
                        <div className="min-w-[100px]">
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="font-medium">{c.skillPct}%</span>
                            <span className="text-neutral-400 dark:text-gray-500">
                              {c.masteredSkills}/{c.totalSkills}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-gray-700">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600"
                              style={{ width: `${Math.max(c.skillPct, 3)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-neutral-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.avgAccuracy !== null ? (
                        <span
                          className={
                            c.avgAccuracy >= 80
                              ? 'font-medium text-green-600'
                              : c.avgAccuracy >= 60
                                ? 'font-medium text-amber-600'
                                : 'font-medium text-red-500'
                          }
                        >
                          {c.avgAccuracy}%
                        </span>
                      ) : (
                        <span className="text-neutral-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-amber-600" title="星星"><Icon name="star" className="h-3.5 w-3.5" />{c.stars}</span>
                        {c.streak > 0 && (
                          <span className="inline-flex items-center gap-1 text-orange-600" title="連續天數"><Icon name="fire" className="h-3.5 w-3.5" />{c.streak}</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-500 dark:text-gray-400">
                      {c.lastSession ? relativeTime(c.lastSession.startedAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  )
}
