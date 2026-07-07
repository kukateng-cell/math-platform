import Link from 'next/link'
import { getRecentAttempts } from '@/actions/admin'
import { Icon } from '@/components/icon'

export default async function AdminAttemptsPage() {
  const attempts = await getRecentAttempts(50)

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <Link href="/admin" className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-gray-400 dark:hover:text-white">
        ← 返回後台
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold">最近作答紀錄</h1>

      {attempts.length === 0 ? (
        <p className="rounded-xl border border-neutral-200 bg-white p-6 text-center text-neutral-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500">
          尚無作答紀錄
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2 font-medium">時間</th>
                <th className="px-4 py-2 font-medium">孩子</th>
                <th className="px-4 py-2 font-medium">技能</th>
                <th className="px-4 py-2 font-medium">題目</th>
                <th className="px-4 py-2 font-medium">作答</th>
                <th className="px-4 py-2 font-medium">結果</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id} className="border-b border-neutral-100 last:border-0 dark:border-gray-800">
                  <td className="px-4 py-2 text-neutral-400 dark:text-gray-500">
                    {new Date(a.createdAt).toLocaleString('zh-TW', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-2">{a.session.child.nickname}</td>
                  <td className="px-4 py-2 text-neutral-600 dark:text-gray-300">{a.session.skill.name}</td>
                  <td className="px-4 py-2 text-neutral-600 dark:text-gray-300">{a.questionPrompt}</td>
                  <td className="px-4 py-2">
                    <span className={a.isCorrect ? '' : 'text-red-500 line-through'}>
                      {a.userAnswer}
                    </span>
                    {a.assisted && (
                      <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-700">陪</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {a.isCorrect ? (
                      <span className="inline-flex text-green-600"><Icon name="check" className="h-4 w-4" /></span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-500"><Icon name="x" className="h-4 w-4" /> ({a.correctAnswer})</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
