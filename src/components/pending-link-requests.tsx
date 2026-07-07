'use client'

import { confirmLink, rejectLink } from '@/actions/student-auth'

type PendingRequest = {
  linkId: string
  childId: string
  nickname: string
  gradeLevel: string
  email: string | null
  createdAt: Date
}

// 家長儀表板：列出「待確認」的學生綁定請求，供家長確認 / 拒絕
// 安全：學生只知道家長 email 不足以完成綁定，須家長在此明確確認後才生效
export default function PendingLinkRequests({ requests }: { requests: PendingRequest[] }) {
  return (
    <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">🔗</span>
        <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          待確認的綁定請求（{requests.length}）
        </h2>
      </div>
      <p className="mb-3 text-xs text-amber-700/80 dark:text-amber-400/70">
        以下學生希望與您的帳號建立綁定關係。確認後您才能查看該學生的學習資料。
      </p>
      <ul className="space-y-2">
        {requests.map((req) => (
          <li key={req.linkId}>
            <RequestRow req={req} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function RequestRow({ req }: { req: PendingRequest }) {
  // 單一 form，兩顆 submit 按鈕各自綁定不同 server action（formAction）
  // confirmLink / rejectLink 成功後會 revalidatePath('/dashboard')，本列會自動消失
  return (
    <form className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-white p-3 dark:border-amber-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
      <input type="hidden" name="linkId" value={req.linkId} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-base">🧒</span>
        <span className="font-medium text-neutral-800 dark:text-gray-100">{req.nickname}</span>
        <span className="text-neutral-400 dark:text-gray-500">·</span>
        <span className="text-neutral-500 dark:text-gray-400">
          {req.gradeLevel === 'K' ? '幼兒園' : `${req.gradeLevel.replace('G', '')}年級`}
        </span>
        {req.email && (
          <>
            <span className="text-neutral-400 dark:text-gray-500">·</span>
            <span className="text-neutral-500 dark:text-gray-400">{req.email}</span>
          </>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        {/* 拒絕：刪除這筆 PENDING 請求 */}
        <button
          type="submit"
          formAction={rejectLink}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          拒絕
        </button>
        {/* 確認：PENDING → ACTIVE，之後家長即可存取該學生資料 */}
        <button
          type="submit"
          formAction={confirmLink}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-green-700"
        >
          確認綁定
        </button>
      </div>
    </form>
  )
}
