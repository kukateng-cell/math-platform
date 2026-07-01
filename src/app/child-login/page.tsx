import Link from 'next/link'
import { getChildSession } from '@/lib/child-session'
import ChildPinForm from '@/components/child-pin-form'

export default async function ChildLoginPage() {
  const childSession = await getChildSession()

  // 已經有孩子 session → 直接跳練習選單
  if (childSession) {
    return (
      <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="text-6xl">🧒</div>
        <h1 className="text-2xl font-bold">{childSession.nickname}，歡迎回來！</h1>
        <div className="flex flex-col gap-3">
          <Link
            href={`/practice/${childSession.childId}`}
            className="rounded-xl bg-blue-600 px-8 py-3 font-medium text-white transition hover:bg-blue-700"
          >
            繼續練習 →
          </Link>
          <form action="/actions/child-auth" method="POST">
            <button
              type="submit"
              className="text-sm text-neutral-400 hover:text-neutral-600"
            >
              換一個孩子
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <div className="mb-2 text-5xl">🧒</div>
        <h1 className="text-2xl font-bold">孩子練習模式</h1>
        <p className="mt-1 text-sm text-neutral-500">
          請家長輸入孩子的 4 位數 PIN 碼
        </p>
      </div>
      <ChildPinForm />
      <Link href="/login" className="text-sm text-blue-600 hover:underline">
        家長登入 →
      </Link>
    </main>
  )
}
