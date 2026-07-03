import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { contains: '@demo.com' } },
    include: {
      childProfiles: {
        include: {
          sessions: {
            include: { skill: true, attempts: true },
          },
          masterySnapshots: { include: { skill: true } },
          badges: { include: { badge: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\n=== 假账号总数: ${users.length} ===\n`);

  for (const u of users) {
    console.log('──────────────────────────────────────');
    console.log(`账号: ${u.email}`);
    console.log(`姓名: ${u.name}  | 角色: ${u.role}`);
    console.log(`创建时间: ${u.createdAt.toISOString()}`);
    console.log(`孩子档案数: ${u.childProfiles.length}`);

    for (const c of u.childProfiles) {
      const sessions = c.sessions;
      const allAttempts = sessions.flatMap((s) => s.attempts);
      const correct = allAttempts.filter((a) => a.isCorrect).length;
      const mastery = c.masterySnapshots;

      console.log(`\n  孩子档案: ${c.nickname}  (年级 ${c.gradeLevel})  模式: ${c.mode}`);
      console.log(`  • 星星: ${c.stars}  | 连续天数: ${c.streak}`);
      console.log(`  • 练习会话数: ${sessions.length}`);
      console.log(`  • 答题总数: ${allAttempts.length}  | 答对: ${correct}  | 正确率: ${allAttempts.length ? Math.round((correct / allAttempts.length) * 100) : 0}%`);
      console.log(`  • 最近一次会话: ${sessions.length ? sessions[sessions.length - 1].startedAt.toISOString() : '—'}`);

      if (mastery.length) {
        console.log(`  • 知识点掌握记录 (skill → 掌握度):`);
        for (const m of mastery) {
          console.log(`      - ${m.skill.code.padEnd(18)} ${(m.masteryLevel * 100).toFixed(0)}%  (最近 ${m.recentCorrect}/${m.recentTotal})`);
        }
      } else {
        console.log(`  • 知识点掌握记录: 0`);
      }

      console.log(`  • 获得徽章: ${c.badges.length}`);
      for (const b of c.badges) {
        console.log(`      - ${b.badge.icon} ${b.badge.name}  (${b.badge.code})`);
      }

      // 统计各 skill
      if (sessions.length) {
        const bySkill: Record<string, { total: number; correct: number }> = {};
        for (const s of sessions) {
          const key = s.skill.code;
          bySkill[key] ??= { total: 0, correct: 0 };
          bySkill[key].total += s.totalQuestions;
          bySkill[key].correct += s.correctCount;
        }
        console.log(`  • 各知识点答题情况:`);
        for (const [skill, st] of Object.entries(bySkill)) {
          console.log(`      - ${skill.padEnd(18)} ${st.correct}/${st.total} 正确`);
        }
      }
    }
    console.log('');
  }

  // 全局统计
  const totalSessions = users.reduce((n, u) => n + u.childProfiles.reduce((m, c) => m + c.sessions.length, 0), 0);
  const totalAttempts = users.reduce((n, u) => n + u.childProfiles.reduce((m, c) => m + c.sessions.reduce((k, s) => k + s.attempts.length, 0), 0), 0);
  const totalBadges = users.reduce((n, u) => n + u.childProfiles.reduce((m, c) => m + c.badges.length, 0), 0);

  console.log('══════════════════════════════════════');
  console.log(`全局统计: ${users.length} 个假账号 / ${totalSessions} 个会话 / ${totalAttempts} 次答题 / ${totalBadges} 个徽章`);
  console.log('══════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
