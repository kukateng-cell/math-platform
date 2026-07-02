import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'

const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

async function main() {
  console.log('Tables row counts:')
  console.log('  User            :', await p.user.count())
  console.log('  Skill           :', await p.skill.count())
  console.log('  Badge           :', await p.badge.count())
  console.log('  QuestionTemplate:', await p.questionTemplate.count())
  console.log('  ChildProfile    :', await p.childProfile.count())
  const admin = await p.user.findFirst({ where: { email: 'admin@math.local' } })
  console.log('  Admin exists    :', !!admin, '| role:', admin?.role)
  await p.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
