import { notFound } from 'next/navigation'
import { getSessionQuestions } from '@/actions/practice'
import { getCurrentUser } from '@/actions/auth'
import PracticeClient from '@/components/practice-client'

export default async function PracticeQuestionPage({
  params,
}: {
  params: Promise<{ childId: string; skillId: string; sessionId: string }>
}) {
  const { childId, sessionId } = await params
  const user = await getCurrentUser()
  if (!user) return null

  const data = await getSessionQuestions(sessionId)
  if (!data) notFound()

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <PracticeClient
        questions={data.questions.map((q) => ({ ...q, templateId: q.templateId! }))}
        sessionId={sessionId}
        skillName={data.skillName}
        childNickname={data.childNickname}
        childId={childId}
      />
    </main>
  )
}
