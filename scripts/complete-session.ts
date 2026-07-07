import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const sessionId = 'cmra4u1pi0003dsv5j3lcguro'
  const s = await prisma.practiceSession.findUnique({ where: { id: sessionId } })
  console.log('Session:', s?.id, '已完成:', !!s?.completedAt, '总题数:', s?.totalQuestions)

  if (s && !s.completedAt) {
    const existing = new Set((await prisma.attempt.findMany({ where: { sessionId }, select: { questionIndex: true } })).map(a => a.questionIndex))
    console.log('已答题索引:', [...existing])
    const questions = JSON.parse(s.questionsJson || '[]')
    for (let i = 0; i < s.totalQuestions; i++) {
      if (existing.has(i)) continue
      const q = questions[i]
      const isCorrect = i < 7
      await prisma.attempt.create({
        data: {
          sessionId: s.id,
          questionId: q.templateId,
          questionIndex: i,
          questionPrompt: q.prompt,
          userAnswer: isCorrect ? q.answer : 'wrong',
          correctAnswer: q.answer,
          isCorrect,
          assisted: false,
          durationMs: 5000,
        },
      })
      console.log('  补充答题', i, isCorrect ? '✓' : '✗')
    }
    await prisma.practiceSession.update({ where: { id: sessionId }, data: { completedAt: new Date() } })
    console.log('✅ Session 已完成')
  }
}
main().finally(() => prisma.$disconnect())
