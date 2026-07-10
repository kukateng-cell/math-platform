/**
 * P0-1 修復遷移：為既有題目模板補上 hint 欄位
 *
 * 背景：原本 explanation 欄位經常包含完整答案或算式（如 "3 + 2 = 5"），
 * 前端在作答前就顯示 explanation，學生可以直接看答案。
 *
 * 修復後：
 *   - explanation 保留原樣（作答後才顯示，含答案沒問題）
 *   - 新增 hint 欄位（作答前顯示，不含答案）
 *
 * 此腳本為既有題庫批量補上安全的 hint 文字。
 *
 * 執行方式：
 *   npx tsx scripts/add-hints-to-questions.ts
 */
import { PrismaClient } from '../src/generated/prisma/client.js'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL not set')
    process.exit(1)
  }

  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    // 依技能 code 分類的安全提示文字（不含答案）
    const hintsBySkillCode: Record<string, string> = {
      'count-objects': '一個一個慢慢數，可以用手指或畫圈圈幫忙',
      'count-compare': '先數一數每一邊有幾個，再比較大小',
      'shape-recognition': '注意看圖形的邊和角，想一想它是什麼形狀',
      'add-within-10': '把兩個數合在一起，可以用手指或積木幫忙算',
      'add-within-20': '先算個位數，湊到 10 再繼續加',
      'sub-within-10': '從大數裡拿走小數，想一想剩下多少',
      'sub-within-20': '可以先湊 10 再減，或用畫圖的方式幫忙',
      'add-sub-100': '注意十位數和個位數要對齊再算',
      'word-problem': '先找出題目裡的數字，判斷是要加還是減',
      'intro-multiply': '乘法就是連加，例如 4×3 就是 4+4+4',
      'multiply-6-9': '背九九乘法表，想想看口訣是什麼',
      'multiply-table': '用九九乘法口訣來算',
      'divide-basic': '除法就是平分，想想看每人可以分到多少',
      'add-sub-1000': '注意百位、十位、個位要對齊',
      'mixed-operations': '先乘除後加減，有括號先算括號',
      'time-calc': '把時間換算成分鐘來算比較不容易出錯',
      'area-perimeter': '周長是繞一圈的長度，面積是裡面的大小',
      'decimal-intro': '小數點要對齊，像整數一樣計算',
      'large-multiply': '用直式算，注意進位',
      'triangle': '注意三個角的大小，想想看屬於哪一類',
      'two-digit-div': '想想看什麼數乘以除數會等於被除數',
      'decimal-multiply-divide': '先算數字，再算小數位數',
      'factors-multiples': '用質因數分解來找公因數和公倍數',
      'equation': '把 x 留在一邊，數字移到另一邊，記得兩邊要平衡',
      'polygon-formula': '回想看看這個圖形的公式是什麼',
      'fraction-multiply-divide': '乘法分子乘分子、分母乘分母；除法要倒數後相乘',
      'ratio': '把比例寫成分數來算',
    }

    // 查出所有沒有 hint 的題目模板（含技能 code）
    const templates = await prisma.questionTemplate.findMany({
      where: { hint: null },
      include: { skill: { select: { code: true } } },
    })

    console.log(`找到 ${templates.length} 個沒有 hint 的題目模板`)

    let updated = 0
    for (const t of templates) {
      const skillCode = t.skill.code
      const hint = hintsBySkillCode[skillCode]
      if (hint) {
        await prisma.questionTemplate.update({
          where: { id: t.id },
          data: { hint },
        })
        updated++
      }
    }

    console.log(`✅ 已為 ${updated} 個模板補上 hint（其餘 ${templates.length - updated} 個找不到對應技能 code，略過）`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
