import Link from 'next/link'
import { getCurrentUser } from '@/actions/auth'
import DeleteAccountForm from '@/components/delete-account-form'

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) return null

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link
        href="/dashboard"
        className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-gray-400 dark:hover:text-white"
      >
        ← 返回我的孩子
      </Link>

      <h1 className="mt-2 mb-6 text-2xl font-bold">帳號設定</h1>

      {/* ============ 帳號資訊 ============ */}
      <section className="mb-8 rounded-xl border border-neutral-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-3 text-lg font-semibold">帳號資訊</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500 dark:text-gray-400">姓名</dt>
            <dd className="font-medium">{user.name ?? '（未設定）'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500 dark:text-gray-400">Email</dt>
            <dd className="font-medium">{user.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500 dark:text-gray-400">角色</dt>
            <dd className="font-medium">{user.role === 'ADMIN' ? '管理員' : '家長'}</dd>
          </div>
        </dl>
      </section>

      {/* ============ 資料與隱私（GDPR）============ */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-1 text-lg font-semibold">資料與隱私</h2>
        <p className="mb-4 text-sm text-neutral-500 dark:text-gray-400">
          依據隱私權規範，你可以下載備份或永久刪除帳號資料。
        </p>

        <div className="mb-4">
          <h3 className="mb-1 text-sm font-medium">📥 下載你的資料</h3>
          <p className="mb-2 text-xs text-neutral-500 dark:text-gray-400">
            到每個孩子的「學習概覽」頁面，點「📥 匯出資料」即可下載該孩子的完整練習紀錄（CSV）。
          </p>
          <Link
            href="/dashboard"
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            前往孩子列表 →
          </Link>
        </div>

        <div className="border-t border-neutral-200 pt-4 dark:border-gray-700">
          <h3 className="mb-1 text-sm font-medium">危險區域</h3>
          <p className="mb-3 text-xs text-neutral-500 dark:text-gray-400">
            永久刪除帳號及所有關聯資料，此操作不可復原。
          </p>
          <DeleteAccountForm />
        </div>
      </section>
    </main>
  )
}
