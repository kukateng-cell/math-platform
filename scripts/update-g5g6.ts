// 快速腳本：更新 G5/G6 技能與題目（不影響現有 K-G4 資料）
import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('📦 更新 G5/G6 技能與題目...\n')

  // ───────── 1. 更新 existing skill ─────────
  // 將 fraction-operations 改名為「分數的加減運算與性質」
  const fractionOps = await prisma.skill.findUnique({ where: { code: 'fraction-operations' } })
  if (fractionOps) {
    await prisma.skill.update({
      where: { id: fractionOps.id },
      data: {
        name: '分數的加減運算與性質',
        description: '異分母分數加減、通分、約分與分數的基本性質',
      },
    })
    console.log(`  ✓ 更新 fraction-operations → 分數的加減運算與性質`)
  }

  // 更新 circle 名稱
  const circle = await prisma.skill.findUnique({ where: { code: 'circle' } })
  if (circle) {
    await prisma.skill.update({
      where: { id: circle.id },
      data: {
        name: '圓',
        description: '圓的定義、圓周率、圓周長與圓面積的計算',
      },
    })
    console.log(`  ✓ 更新 circle → 圓的定義、性質與計算`)
  }

  // 更新 volume-intro 名稱
  const volumeIntro = await prisma.skill.findUnique({ where: { code: 'volume-intro' } })
  if (volumeIntro) {
    await prisma.skill.update({
      where: { id: volumeIntro.id },
      data: {
        name: '體積（長方體與正方體）',
        description: '長方體和正方體的體積公式、表面積與應用',
      },
    })
    console.log(`  ✓ 更新 volume-intro → 體積（長方體與正方體）`)
  }

  // 將 fraction-multiply-divide 移到 G6
  const fracMulDiv = await prisma.skill.findUnique({ where: { code: 'fraction-multiply-divide' } })
  if (fracMulDiv) {
    await prisma.skill.update({
      where: { id: fracMulDiv.id },
      data: { gradeLevel: 'G6', order: 29 },
    })
    console.log(`  ✓ 移動 fraction-multiply-divide → G6`)
  }

  // 更新 ratio 的 order
  const ratio = await prisma.skill.findUnique({ where: { code: 'ratio' } })
  if (ratio) {
    await prisma.skill.update({
      where: { id: ratio.id },
      data: { order: 30 },
    })
  }

  // 更新 percent
  const percent = await prisma.skill.findUnique({ where: { code: 'percent' } })
  if (percent) {
    await prisma.skill.update({
      where: { id: percent.id },
      data: { order: 31 },
    })
  }

  // 更新 circle order
  if (circle) {
    await prisma.skill.update({ where: { id: circle.id }, data: { order: 32 } })
  }

  // 更新 speed
  const speed = await prisma.skill.findUnique({ where: { code: 'speed' } })
  if (speed) {
    await prisma.skill.update({ where: { id: speed.id }, data: { order: 33 } })
  }

  // 更新 prism-volume
  const prismVolume = await prisma.skill.findUnique({ where: { code: 'prism-volume' } })
  if (prismVolume) {
    await prisma.skill.update({ where: { id: prismVolume.id }, data: { order: 34 } })
  }

  // 更新負數、圓錐與圓柱 order
  const negNums = await prisma.skill.findUnique({ where: { code: 'negative-numbers' } })
  if (negNums) {
    await prisma.skill.update({ where: { id: negNums.id }, data: { order: 35 } })
  }

  const coneCyl = await prisma.skill.findUnique({ where: { code: 'cone-cylinder' } })
  if (coneCyl) {
    await prisma.skill.update({ where: { id: coneCyl.id }, data: { order: 36 } })
  }

  // 更新 equation/polygon-formula/factors-multiples orders
  const eq = await prisma.skill.findUnique({ where: { code: 'equation' } })
  if (eq) await prisma.skill.update({ where: { id: eq.id }, data: { order: 26 } })
  const pf = await prisma.skill.findUnique({ where: { code: 'polygon-formula' } })
  if (pf) await prisma.skill.update({ where: { id: pf.id }, data: { order: 27 } })
  const fm = await prisma.skill.findUnique({ where: { code: 'factors-multiples' } })
  if (fm) await prisma.skill.update({ where: { id: fm.id }, data: { order: 28 } })

  console.log(`  ✓ 更新所有技能順序\n`)

  // ───────── 2. 為各新技能新增題目（僅當技能無題目時）─────────
  const skillMap = new Map<string, string>()
  const allSkills = await prisma.skill.findMany()
  for (const s of allSkills) skillMap.set(s.code, s.id)

  const added: string[] = []

  // ─── 方程（equation）───
  const eqQs = [
    { prompt: 'x + 5 = 12，x = ?', answer: '7', expl: '12 - 5 = 7，所以 x = 7' },
    { prompt: 'x - 3 = 8，x = ?', answer: '11', expl: '8 + 3 = 11，所以 x = 11' },
    { prompt: '2x = 10，x = ?', answer: '5', expl: '10 ÷ 2 = 5，所以 x = 5' },
    { prompt: 'x ÷ 4 = 3，x = ?', answer: '12', expl: '3 × 4 = 12，所以 x = 12' },
    { prompt: 'x + 7 = 15，x = ?', answer: '8' },
    { prompt: 'x - 6 = 5，x = ?', answer: '11' },
    { prompt: '3x = 18，x = ?', answer: '6' },
    { prompt: 'x ÷ 5 = 4，x = ?', answer: '20' },
    { prompt: 'x + 9 = 20，x = ?', answer: '11' },
    { prompt: 'x - 12 = 8，x = ?', answer: '20' },
    { prompt: '4x = 24，x = ?', answer: '6' },
    { prompt: 'x ÷ 6 = 5，x = ?', answer: '30' },
    { prompt: '2x + 3 = 11，x = ?', answer: '4', expl: '先減 3：11-3=8，再除以 2：8÷2=4' },
    { prompt: '3x - 4 = 14，x = ?', answer: '6', expl: '先加 4：14+4=18，再除以 3：18÷3=6' },
    { prompt: '5x + 5 = 30，x = ?', answer: '5', expl: '先減 5：30-5=25，再除以 5：25÷5=5' },
    { prompt: '2x - 1 = 9，x = ?', answer: '5' },
    { prompt: 'x + x = 14，x = ?', answer: '7' },
    { prompt: '3x - x = 12，x = ?', answer: '6' },
    { prompt: '小華有 x 元，買 25 元的書後剩 30 元，原有 ? 元', answer: '55', expl: 'x - 25 = 30，x = 55' },
    { prompt: '一個數乘以 4 等於 36，這個數是？', answer: '9', expl: '4x = 36，x = 9' },
  ]
  const eqId = skillMap.get('equation')
  let eqCount = await prisma.questionTemplate.count({ where: { skillId: eqId! } })
  if (eqId && eqCount === 0) {
    for (const q of eqQs) {
      await prisma.questionTemplate.create({
        data: { skillId: eqId, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: q.expl ?? '用加減乘除的逆運算來解未知數' },
      })
    }
    added.push(`方程 (${eqQs.length} 題)`)
  }

  // ─── 多邊形的公式計算（polygon-formula）───
  const pfQs = [
    { prompt: '平行四邊形底 6cm、高 4cm，面積？', answer: '24', expl: '面積 = 底 × 高 = 6 × 4 = 24 cm²' },
    { prompt: '三角形底 8cm、高 5cm，面積？', answer: '20', expl: '面積 = 底 × 高 ÷ 2 = 8 × 5 ÷ 2 = 20 cm²' },
    { prompt: '梯形上底 3cm、下底 7cm、高 4cm，面積？', answer: '20', expl: '面積 = (上底+下底) × 高 ÷ 2 = 10 × 4 ÷ 2 = 20 cm²' },
    { prompt: '平行四邊形底 10cm、高 6cm，面積？', answer: '60' },
    { prompt: '三角形底 12cm、高 8cm，面積？', answer: '48' },
    { prompt: '梯形上底 4cm、下底 6cm、高 5cm，面積？', answer: '25' },
    { prompt: '平行四邊形面積 48cm²、底 8cm，高？', answer: '6', expl: '高 = 面積 ÷ 底 = 48 ÷ 8 = 6 cm' },
    { prompt: '三角形面積 30cm²、底 10cm，高？', answer: '6', expl: '高 = 面積 × 2 ÷ 底 = 60 ÷ 10 = 6 cm' },
    { prompt: '梯形面積 36cm²、高 6cm、上底 4cm，下底？', answer: '8', expl: '(4+下底)×6÷2=36，4+下底=12，下底=8' },
    { prompt: '平行四邊形底 5cm、高 3cm，面積？', answer: '15' },
    { prompt: '三角形底 6cm、高 9cm，面積？', answer: '27' },
    { prompt: '梯形上底 2cm、下底 8cm、高 3cm，面積？', answer: '15' },
    { prompt: '平行四邊形面積 72cm²、高 8cm，底？', answer: '9' },
    { prompt: '三角形面積 24cm²、高 6cm，底？', answer: '8' },
    { prompt: '梯形上底 5cm、下底 9cm、高 4cm，面積？', answer: '28' },
  ]
  const pfId = skillMap.get('polygon-formula')
  let pfCount = await prisma.questionTemplate.count({ where: { skillId: pfId! } })
  if (pfId && pfCount === 0) {
    for (const q of pfQs) {
      await prisma.questionTemplate.create({
        data: { skillId: pfId, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: q.expl ?? '平行四邊形面積=底×高；三角形面積=底×高÷2；梯形面積=(上底+下底)×高÷2' },
      })
    }
    added.push(`多邊形的公式計算 (${pfQs.length} 題)`)
  }

  // ─── 因數與倍數（factors-multiples）───
  const fmQs = [
    { prompt: '12 的因數有哪些？（由小到大，逗號分隔）', answer: '1,2,3,4,6,12', expl: '12 = 1×12 = 2×6 = 3×4' },
    { prompt: '8 的倍數列出 3 個（逗號分隔）', answer: '8,16,24', expl: '8×1=8, 8×2=16, 8×3=24' },
    { prompt: '6 和 8 的最大公因數？', answer: '2', expl: '6的因數：1,2,3,6；8的因數：1,2,4,8' },
    { prompt: '4 和 6 的最小公倍數？', answer: '12', expl: '4的倍數：4,8,12...；6的倍數：6,12,18...' },
    { prompt: '15 的因數？（逗號分隔）', answer: '1,3,5,15' },
    { prompt: '9 和 12 的最大公因數？', answer: '3' },
    { prompt: '6 和 9 的最小公倍數？', answer: '18' },
    { prompt: '24 的因數？（逗號分隔）', answer: '1,2,3,4,6,8,12,24' },
    { prompt: '10 和 15 的最大公因數？', answer: '5' },
    { prompt: '8 和 10 的最小公倍數？', answer: '40' },
    { prompt: '以下是質數的有？1, 2, 3, 4, 5, 6', answer: '2,3,5', expl: '質數只有 1 和自己兩個因數' },
    { prompt: '以下是合數的有？2, 4, 6, 7, 9', answer: '4,6,9' },
    { prompt: '16 和 24 的最大公因數？', answer: '8' },
    { prompt: '12 和 18 的最小公倍數？', answer: '36' },
    { prompt: '7 是質數還是合數？', answer: '質數' },
    { prompt: '36 的因數？（逗號分隔）', answer: '1,2,3,4,6,9,12,18,36' },
    { prompt: '20 和 30 的最大公因數？', answer: '10' },
    { prompt: '9 和 15 的最小公倍數？', answer: '45' },
    { prompt: '下列哪個是質數？8, 11, 15, 21', answer: '11' },
  ]
  const fmId = skillMap.get('factors-multiples')
  let fmCount = await prisma.questionTemplate.count({ where: { skillId: fmId! } })
  if (fmId && fmCount === 0) {
    for (const q of fmQs) {
      await prisma.questionTemplate.create({
        data: { skillId: fmId, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: q.expl ?? '因數：能整除該數的整數；倍數：該數乘以整數的結果' },
      })
    }
    added.push(`因數與倍數 (${fmQs.length} 題)`)
  }

  // ─── 負數（negative-numbers）───
  const negQs = [
    { prompt: '溫度從 0°C 下降 5°C 是幾度？', answer: '-5' },
    { prompt: '溫度從 3°C 下降 8°C 是幾度？', answer: '-5' },
    { prompt: '負數在數線上，0 的左邊還是右邊？', answer: '左邊' },
    { prompt: '-3 和 -7 哪個比較大？', answer: '-3' },
    { prompt: '-5 和 2 哪個比較小？', answer: '-5' },
    { prompt: '|-3| = ?（絕對值）', answer: '3' },
    { prompt: '|-8| = ?', answer: '8' },
    { prompt: '-2 + (-3) = ?', answer: '-5' },
    { prompt: '5 + (-3) = ?', answer: '2' },
    { prompt: '-4 + 7 = ?', answer: '3' },
    { prompt: '-6 - 2 = ?', answer: '-8' },
    { prompt: '3 - (-2) = ?', answer: '5' },
    { prompt: '-4 - (-1) = ?', answer: '-3' },
    { prompt: '海拔 0 公尺，潛水艇在水下 50 公尺是？', answer: '-50' },
    { prompt: '比 -3 大 1 的數是？', answer: '-2' },
    { prompt: '比 -5 小 2 的數是？', answer: '-7' },
    { prompt: '|-7| - |3| = ?', answer: '4' },
    { prompt: '|-5| + |-2| = ?', answer: '7' },
    { prompt: '-1, 0, -3, 2 由小到大排序', answer: '-3,-1,0,2' },
  ]
  const negId = skillMap.get('negative-numbers')
  let negCount = await prisma.questionTemplate.count({ where: { skillId: negId! } })
  if (negId && negCount === 0) {
    for (const q of negQs) {
      await prisma.questionTemplate.create({
        data: { skillId: negId, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: '負數小於 0，在數線上 0 的左邊；絕對值表示該數到 0 的距離' },
      })
    }
    added.push(`負數 (${negQs.length} 題)`)
  }

  // ─── 圓錐與圓柱（cone-cylinder）───
  const ccQs = [
    { prompt: '圓柱半徑 3cm、高 5cm，表面積？(π=3.14)', answer: '150.72', expl: '表面積=2πr²+2πrh=2×3.14×9+2×3.14×3×5=56.52+94.2=150.72' },
    { prompt: '圓柱半徑 2cm、高 6cm，體積？(π=3.14)', answer: '75.36', expl: '體積=πr²h=3.14×4×6=75.36' },
    { prompt: '圓錐半徑 3cm、高 6cm，體積？(π=3.14)', answer: '56.52', expl: '圓錐體積=1/3×πr²h=1/3×3.14×9×6=56.52' },
    { prompt: '圓錐半徑 4cm、高 9cm，體積？(π=3.14)', answer: '150.72' },
    { prompt: '圓柱半徑 5cm、高 10cm，體積？(π=3.14)', answer: '785' },
    { prompt: '圓錐半徑 2cm、高 3cm，體積？(π=3.14)', answer: '12.56' },
    { prompt: '圓柱半徑 4cm、高 8cm，表面積？(π=3.14)', answer: '301.44' },
    { prompt: '圓錐半徑 6cm、高 5cm，體積？(π=3.14)', answer: '188.4' },
    { prompt: '圓柱半徑 1cm、高 10cm，體積？(π=3.14)', answer: '31.4' },
    { prompt: '圓錐半徑 3cm、高 9cm，體積？(π=3.14)', answer: '84.78' },
    { prompt: '圓柱半徑 2cm、高 5cm，表面積？(π=3.14)', answer: '87.92' },
    { prompt: '等底等高的圓柱和圓錐，圓柱體積是圓錐的幾倍？', answer: '3', expl: '圓柱體積=πr²h，圓錐體積=1/3πr²h' },
    { prompt: '等底等高的圓錐體積 30cm³，圓柱體積？', answer: '90' },
    { prompt: '圓柱半徑 6cm、高 2cm，體積？(π=3.14)', answer: '226.08' },
    { prompt: '圓錐半徑 5cm、高 12cm，體積？(π=3.14)', answer: '314' },
  ]
  const ccId = skillMap.get('cone-cylinder')
  let ccCount = await prisma.questionTemplate.count({ where: { skillId: ccId! } })
  if (ccId && ccCount === 0) {
    for (const q of ccQs) {
      await prisma.questionTemplate.create({
        data: { skillId: ccId, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: q.expl ?? '圓柱體積=πr²h，表面積=2πr²+2πrh；圓錐體積=1/3×πr²h' },
      })
    }
    added.push(`圓錐與圓柱 (${ccQs.length} 題)`)
  }

  // ─── 分數乘除法（fraction-multiply-divide，已移到 G6）───
  const fmdQs = [
    { prompt: '1/2 × 1/3 = ?', answer: '1/6' }, { prompt: '2/3 × 3/4 = ?', answer: '1/2' },
    { prompt: '1/4 × 2/5 = ?', answer: '1/10' }, { prompt: '3/5 × 5/6 = ?', answer: '1/2' },
    { prompt: '1/2 ÷ 1/3 = ?', answer: '3/2' }, { prompt: '2/3 ÷ 1/4 = ?', answer: '8/3' },
    { prompt: '3/4 ÷ 1/2 = ?', answer: '3/2' }, { prompt: '1/3 × 3/5 = ?', answer: '1/5' },
    { prompt: '5/6 ÷ 2/3 = ?', answer: '5/4' }, { prompt: '2/5 × 5/7 = ?', answer: '2/7' },
    { prompt: '1/3 × 1/4 = ?', answer: '1/12' },
    { prompt: '3/4 × 2/5 = ?', answer: '3/10' },
    { prompt: '2/3 × 5/7 = ?', answer: '10/21' },
    { prompt: '4/5 × 1/2 = ?', answer: '2/5' },
    { prompt: '1/2 ÷ 1/4 = ?', answer: '2' },
    { prompt: '3/5 ÷ 2/3 = ?', answer: '9/10' },
    { prompt: '2/3 ÷ 5/6 = ?', answer: '4/5' },
    { prompt: '5/8 ÷ 1/4 = ?', answer: '5/2' },
    { prompt: '整數 4 × 2/3 = ?', answer: '8/3' },
    { prompt: '3/7 × 14 = ?', answer: '6' },
    { prompt: '5/6 × 3 = ?', answer: '5/2' },
    { prompt: '2 ÷ 1/3 = ?', answer: '6' },
    { prompt: '2/3 的倒數是？', answer: '3/2' },
    { prompt: '5 的倒數是？', answer: '1/5' },
    { prompt: '1 的倒數是？', answer: '1' },
  ]
  const fmdId = skillMap.get('fraction-multiply-divide')
  let fmdCount = await prisma.questionTemplate.count({ where: { skillId: fmdId! } })
  if (fmdId && fmdCount === 0) {
    for (const q of fmdQs) {
      await prisma.questionTemplate.create({
        data: { skillId: fmdId, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: '分數乘法：分子×分子、分母×分母；除法：乘以倒數' },
      })
    }
    added.push(`分數乘除法 (${fmdQs.length} 題，已搬到 G6)`)
  }

  // 最終統計
  const totalNew = await prisma.questionTemplate.count({
    where: { skillId: { in: [eqId!, pfId!, fmId!, negId!, ccId!, fmdId!].filter(Boolean) } },
  })
  console.log(`  ✨ 新增題目：${added.length > 0 ? added.join('、') : '無（已有題目）'}`)
  console.log(`  📊 新 G5/G6 技能題目總數：${totalNew}`)
  console.log('\n✅ 更新完成！')
}

main()
  .catch((e) => {
    console.error('❌ 錯誤：', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
