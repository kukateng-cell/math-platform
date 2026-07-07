import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // 清除既有挑戰題，支援重新執行
  const deleted = await prisma.questionTemplate.deleteMany({ where: { isChallenge: true } })
  console.log(`  ✓ Removed ${deleted.count} existing challenge questions`)

  const allSkills = await prisma.skill.findMany({ where: { isActive: true } })
  const skillByName = new Map(allSkills.map((s) => [s.code, s]))

  const challengeQuestions: { skillCode: string; prompt: string; answer: string; options?: string; expl?: string }[] = [
    { skillCode: 'count-objects', prompt: '小明有 3 顆蘋果，媽媽又給了他 2 顆，他現在有幾顆？', answer: '5', expl: '3 + 2 = 5' },
    { skillCode: 'shape-recognition', prompt: '下列哪個圖形有 4 個邊？', answer: '正方形', options: '圓形,三角形,正方形,星形' },
    { skillCode: 'count-compare', prompt: '8 和 5 誰比較大？比較大的數減去比較小的數是多少？', answer: '3', expl: '8 - 5 = 3' },
    { skillCode: 'add-within-10', prompt: '樹上有 2 隻小鳥，又飛來了 6 隻，現在樹上有幾隻小鳥？', answer: '8', expl: '2 + 6 = 8' },
    { skillCode: 'sub-within-10', prompt: '媽媽有 9 顆糖，分給 4 個孩子每人一顆，還剩下幾顆？', answer: '5', expl: '9 - 4 = 5' },
    { skillCode: 'add-within-20', prompt: '停車場有 7 輛車，又開進來 8 輛，停車場現在有幾輛車？', answer: '15', expl: '7 + 8 = 15' },
    { skillCode: 'intro-multiply', prompt: '每張桌子有 4 隻腳，6 張桌子共有幾隻腳？', answer: '24', expl: '4 × 6 = 24' },
    { skillCode: 'multiply-6-9', prompt: '一週有 7 天，8 週共有幾天？', answer: '56', expl: '7 × 8 = 56' },
    { skillCode: 'multiply-table', prompt: '9 × 9 = ?', answer: '81', expl: '九九乘法：9 × 9 = 81' },
    { skillCode: 'divide-basic', prompt: '48 顆糖果平分給 6 個人，每人拿到幾顆？', answer: '8', expl: '48 ÷ 6 = 8' },
    { skillCode: 'word-problem', prompt: '一枝筆 7 元，小明買了 5 枝，共花了多少元？', answer: '35', expl: '7 × 5 = 35' },
    { skillCode: 'add-sub-100', prompt: '小美有 156 元，買文具花了 78 元，還剩下多少元？', answer: '78', expl: '156 - 78 = 78' },
    { skillCode: 'mixed-operations', prompt: '36 ÷ 4 + 5 × 3 = ?', answer: '24', expl: '先算 36÷4=9，再算 5×3=15，最後 9+15=24' },
    { skillCode: 'time-calc', prompt: '上午 9:30 到下午 2:15，經過了幾小時幾分？', answer: '4h45m', expl: '9:30→14:15 共 4 小時 45 分鐘' },
    { skillCode: 'area-perimeter', prompt: '長方形長 12cm、寬 8cm，周長是多少？', answer: '40', expl: '周長=2×(12+8)=40cm', options: '40,20,96,48' },
    { skillCode: 'area-perimeter', prompt: '長方形長 12cm、寬 8cm，面積是多少？', answer: '96', expl: '面積=12×8=96cm²', options: '96,40,20,48' },
    { skillCode: 'decimal-intro', prompt: '12.5 + 3.7 = ?', answer: '16.2', expl: '對齊小數點：12.5 + 3.7 = 16.2' },
    { skillCode: 'large-multiply', prompt: '23 × 45 = ?', answer: '1035', expl: '23 × 45 = 23 × (40+5) = 920 + 115 = 1035' },
    { skillCode: 'triangle', prompt: '三角形的三個角分別是 45°、60°、75°，這是一個什麼三角形？', answer: '銳角三角形', expl: '三個角都小於 90°，所以是銳角三角形', options: '銳角三角形,直角三角形,鈍角三角形,等腰三角形' },
    { skillCode: 'two-digit-div', prompt: '144 ÷ 12 = ?', answer: '12', expl: '12 × 12 = 144' },
    { skillCode: 'decimal-multiply-divide', prompt: '3.6 × 2.5 = ?', answer: '9', expl: '3.6 × 2.5 = 9' },
    { skillCode: 'factors-multiples', prompt: '12 和 18 的最小公倍數是多少？', answer: '36', expl: '12=2²×3，18=2×3²，最小公倍數=2²×3²=36' },
    { skillCode: 'equation', prompt: '解方程：3x + 7 = 22，x = ?', answer: '5', expl: '3x + 7 = 22 → 3x = 15 → x = 5' },
    { skillCode: 'polygon-formula', prompt: '三角形底 10cm、高 8cm，面積是多少？', answer: '40', expl: '三角形面積 = 底 × 高 ÷ 2 = 10 × 8 ÷ 2 = 40cm²' },
    { skillCode: 'fraction-multiply-divide', prompt: '2/3 × 3/4 = ? （請輸入分數 a/b 格式）', answer: '1/2', expl: '2/3 × 3/4 = 6/12 = 1/2' },
    { skillCode: 'ratio', prompt: '甲：乙 = 3：2，甲有 30 元，乙有多少元？', answer: '20', expl: '3:2 = 30:乙 → 乙 = 30 × 2 ÷ 3 = 20' },
    { skillCode: 'fraction-multiply-divide', prompt: '5/6 ÷ 2/3 = ? （請輸入分數 a/b 格式）', answer: '5/4', expl: '5/6 ÷ 2/3 = 5/6 × 3/2 = 15/12 = 5/4' },
    { skillCode: 'ratio', prompt: '地圖比例尺 1:50000，兩地圖上距離 4cm，實際距離多少公里？', answer: '2', expl: '4 × 50000 = 200000cm = 2km' },
  ]

  let added = 0
  for (const q of challengeQuestions) {
    const skill = skillByName.get(q.skillCode)
    if (!skill) { console.log('  ⚠ 未找到技能', q.skillCode); continue }
    await prisma.questionTemplate.create({
      data: { skillId: skill.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, options: q.options ?? null, explanation: q.expl ?? null, isChallenge: true },
    })
    added++
  }

  const total = await prisma.questionTemplate.count({ where: { isChallenge: true } })
  console.log(`  ✓ Added ${added} challenge questions, total in DB: ${total}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
