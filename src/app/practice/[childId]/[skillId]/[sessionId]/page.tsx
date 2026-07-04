import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionQuestions, hasPracticeAccess } from '@/actions/practice'
import PracticeClient from '@/components/practice-client'

export default async function PracticeQuestionPage({
  params,
}: {
  params: Promise<{ childId: string; skillId: string; sessionId: string }>
}) {
  const { childId, sessionId } = await params
  // 練習路由支援家長 session 或孩子 session
  const hasAccess = await hasPracticeAccess()
  if (!hasAccess) return null

  const data = await getSessionQuestions(sessionId)
  
  // 若 data 為 null，提供更詳細的錯誤資訊
  if (!data) {
    console.error('Practice session not found:', { sessionId })
    notFound()
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

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 md:max-w-3xl">
      <PracticeClient
        questions={data.questions}
        sessionId={sessionId}
        skillName={data.skillName}
        childNickname={data.childNickname}
        childId={childId}
      />
    </main>
  )
}
