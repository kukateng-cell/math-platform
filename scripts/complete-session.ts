import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const session = await prisma.practiceSession.findFirst({
    where: { childId: 'cmra4u0vc0001dsv5omiot1d8', completedAt: null },
    orderBy: { startedAt: 'desc' },
  })
  if (!session) { console.log('未找到未完成的 session'); return }
  console.log('Session:', session.id, '总题:', session.totalQuestions)
  const questions = JSON.parse(session.questionsJson || '[]')
  const existing = await prisma.attempt.findMany({ where: { sessionId: session.id }, select: { questionIndex: true } })
  const answered = new Set(existing.map(a => a.questionIndex))
  for (let i = 0; i < session.totalQuestions; i++) {
    if (answered.has(i)) continue
    const q = questions[i]
    const ok = i < 5
    await prisma.attempt.create({ data: { sessionId: session.id, questionId: q.templateId, questionIndex: i, questionPrompt: q.prompt, userAnswer: ok ? q.answer : 'x', correctAnswer: q.answer, isCorrect: ok, assisted: false, durationMs: 5000 } })
  }
  await prisma.practiceSession.update({ where: { id: session.id }, data: { completedAt: new Date() } })
  console.log('✅ Session completed')
  const all = await prisma.attempt.findMany({ where: { sessionId: session.id } })
  console.log('Total:', all.length, 'Correct:', all.filter(a => a.isCorrect).length)
}
main().finally(() => prisma.$disconnect())
