import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionQuestions, hasPracticeAccess } from '@/actions/practice'
import PracticeClient from '@/components/practice-client'

export default async function PracticeQuestionPage({
  params,
}: {
  params: Promise<{ childId: string; skillId: string; sessionId: string }>
}) {
  const { childId, skillId, sessionId } = await params
  // 練習路由支援家長 session 或孩子 session（proxy.ts middleware 已先攔檢，此處為雙重確認）
  const hasAccess = await hasPracticeAccess()
  if (!hasAccess) redirect('/login?next=' + encodeURIComponent(`/practice/${childId}/${skillId}/${sessionId}`))

  const data = await getSessionQuestions(sessionId)
  
  // 若 data 為 null，顯示實用錯誤頁面（不直接 404，讓使用者可返回）
  if (!data) {
    console.error('Practice session not found:', { sessionId })
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-16 text-center">
        <div className="mb-4 text-neutral-400 dark:text-gray-500">
          <svg className="mx-auto h-16 w-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
        <h2 className="mb-2 text-xl font-bold">練習無法載入</h2>
        <p className="mb-6 text-neutral-500 dark:text-gray-400">
          找不到這個練習的資料，請重新開始一次新的練習
        </p>
        <Link
          href={`/practice/${childId}`}
          className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700"
        >
          返回練習選單
        </Link>
      </main>
    )
  }

  // 沒有題目快照（舊 session 無 questionsJson）→ 請使用者重新開始
  if (data.questions.length === 0) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-16 text-center">
        <div className="mb-4 text-5xl">📭</div>
        <h2 className="mb-2 text-xl font-bold">題目無法載入</h2>
        <p className="mb-6 text-neutral-500 dark:text-gray-400">
          這個練習的題目資料已遺失，請重新開始一次練習
        </p>
        <Link
          href={`/practice/${childId}`}
          className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700"
        >
          重新選擇技能
        </Link>
      </main>
    )
  }

  // 此練習已在其他設備完成 → 導回練習選單（避免同一套題兩邊同時作答）
  if (data.completed) {
    redirect(`/practice/${childId}?info=already_completed`)
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 md:max-w-3xl">
      <PracticeClient
        questions={data.questions}
        sessionId={sessionId}
        skillName={data.skillName}
        childNickname={data.childNickname}
        childId={childId}
        skillId={skillId}
        initialIndex={data.answeredCount}
        initialCorrectCount={data.correctCount}
        initialQuestionResults={data.answeredResults}
      />
    </main>
  )
}
