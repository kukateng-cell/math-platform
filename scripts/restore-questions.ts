// 還原所有 G3-G6 技能題目（因 seed 被中斷導致題目被刪除）
import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('📦 還原 G3-G6 技能題目...\n')

  const allSkills = await prisma.skill.findMany()
  const sid = (code: string) => allSkills.find(s => s.code === code)?.id!

  let totalAdded = 0

  // ───────── G3: 百以內加減 ─────────
  const addSub100Qs = [
    '56 + 23 = ?:79', '87 - 35 = ?:52', '44 + 38 = ?:82', '73 - 46 = ?:27',
    '62 + 29 = ?:91', '95 - 58 = ?:37', '38 + 47 = ?:85', '81 - 63 = ?:18',
    '55 + 36 = ?:91', '70 - 44 = ?:26', '29 + 58 = ?:87', '64 - 28 = ?:36',
    '46 + 37 = ?:83', '92 - 37 = ?:55', '18 + 75 = ?:93', '53 - 29 = ?:24',
    '35 + 48 = ?:83', '86 - 47 = ?:39', '67 + 26 = ?:93', '100 - 45 = ?:55',
  ]
  await addQuestions(sid('add-sub-100'), addSub100Qs, '')

  // ───────── G3: 乘法進階 ─────────
  const mulAdvQs = [
    '4 × 12 = ?:48', '6 × 13 = ?:78', '7 × 14 = ?:98', '3 × 15 = ?:45',
    '5 × 16 = ?:80', '8 × 12 = ?:96', '9 × 11 = ?:99', '4 × 18 = ?:72',
    '6 × 15 = ?:90', '5 × 19 = ?:95', '7 × 12 = ?:84', '3 × 24 = ?:72',
    '8 × 11 = ?:88', '4 × 22 = ?:88', '6 × 14 = ?:84',
  ]
  await addQuestions(sid('multiply-advanced'), mulAdvQs, '')

  // ───────── G3: 除法進階 ─────────
  const divAdvQs = [
    '36 ÷ 4 = ?:9', '54 ÷ 6 = ?:9', '48 ÷ 8 = ?:6', '63 ÷ 7 = ?:9',
    '72 ÷ 9 = ?:8', '56 ÷ 7 = ?:8', '45 ÷ 5 = ?:9', '32 ÷ 4 = ?:8',
    '42 ÷ 6 = ?:7', '60 ÷ 5 = ?:12', '96 ÷ 8 = ?:12', '84 ÷ 7 = ?:12',
    '28 ÷ 4 = ?:7', '66 ÷ 6 = ?:11', '78 ÷ 6 = ?:13',
  ]
  await addQuestions(sid('divide-advanced'), divAdvQs, '')

  // ───────── G3: 三位數加減 ─────────
  const threeDigQs = [
    '356 + 231 = ?:587', '789 - 345 = ?:444', '405 + 328 = ?:733', '672 - 489 = ?:183',
    '518 + 293 = ?:811', '951 - 637 = ?:314', '264 + 577 = ?:841', '823 - 456 = ?:367',
    '609 + 294 = ?:903', '745 - 368 = ?:377', '437 + 386 = ?:823', '514 - 279 = ?:235',
    '398 + 475 = ?:873', '620 - 431 = ?:189', '546 + 389 = ?:935',
  ]
  await addQuestions(sid('three-digit-add-sub'), threeDigQs, '')

  // ───────── G3: 分數基礎 ─────────
  const fracBaseQs = [
    { p: '把圓平分成 6 份，1 份是幾分之幾？', a: '1/6' },
    { p: '把長方形平分成 5 份，2 份是幾分之幾？', a: '2/5' },
    { p: '1/4 > 1/6 對嗎？', a: '對' },
    { p: '1/3 < 1/2 對嗎？', a: '對' },
    { p: '4/6 約分 = ?', a: '2/3' },
    { p: '2/4 約分 = ?', a: '1/2' },
    { p: '3/9 約分 = ?', a: '1/3' },
    { p: '1/2 = ?/4', a: '2' },
    { p: '1/3 = ?/6', a: '2' },
    { p: '在數線上，0 到 1 分成 4 格，第 3 格是幾分之幾？', a: '3/4' },
  ]
  const iFracId = sid('intro-fraction')
  let iFracCount = await prisma.questionTemplate.count({ where: { skillId: iFracId } })
  if (iFracCount === 0) {
    for (const q of fracBaseQs) {
      await prisma.questionTemplate.create({ data: { skillId: iFracId, type: 'DIRECT', prompt: q.p, answer: q.a, explanation: '分數的分子與分母、約分與等值分數' } })
    }
    totalAdded += fracBaseQs.length
  }

  // ───────── G3: 時間計算 ─────────
  const timeQs = [
    { p: '1 小時 = ? 分鐘', a: '60' }, { p: '2 小時 = ? 分鐘', a: '120' },
    { p: '1 分鐘 = ? 秒', a: '60' }, { p: '3 分鐘 = ? 秒', a: '180' },
    { p: '1 天 = ? 小時', a: '24' }, { p: '半小時 = ? 分鐘', a: '30' },
    { p: '從 3:00 到 4:30 經過了 ? 分鐘', a: '90' }, { p: '從 9:15 到 10:00 經過了 ? 分鐘', a: '45' },
    { p: '從 7:30 到 8:15 經過了 ? 分鐘', a: '45' }, { p: '從 10:00 到 12:30 經過了 ? 分鐘', a: '150' },
    { p: '1 小時 30 分 = ? 分鐘', a: '90' }, { p: '2 小時 15 分 = ? 分鐘', a: '135' },
    { p: '90 分鐘 = ? 小時 ? 分鐘', a: '1小時30分' }, { p: '75 分鐘 = ? 小時 ? 分鐘', a: '1小時15分' },
    { p: '從 11:45 到 12:15 經過了 ? 分鐘', a: '30' },
  ]
  const tId = sid('time-calc')
  let tCount = await prisma.questionTemplate.count({ where: { skillId: tId } })
  if (tCount === 0) {
    for (const q of timeQs) {
      await prisma.questionTemplate.create({ data: { skillId: tId, type: 'DIRECT', prompt: q.p, answer: q.a, explanation: '時間單位換算：1 小時 = 60 分，1 分 = 60 秒' } })
    }
    totalAdded += timeQs.length
  }

  // ───────── G3: 面積與周長 ─────────
  const areaPerimQs = [
    { p: '正方形邊長 3cm，周長？', a: '12' }, { p: '長方形長 5cm 寬 3cm，周長？', a: '16' },
    { p: '正方形邊長 6cm，面積？', a: '36' }, { p: '長方形長 7cm 寬 4cm，面積？', a: '28' },
    { p: '正方形邊長 10cm，周長？', a: '40' }, { p: '長方形長 8cm 寬 2cm，周長？', a: '20' },
    { p: '正方形邊長 4cm，面積？', a: '16' }, { p: '長方形長 9cm 寬 5cm，面積？', a: '45' },
    { p: '正方形周長 20cm，邊長？', a: '5' }, { p: '正方形邊長 2cm，周長是面積的幾倍？', a: '2' },
    { p: '長方形長 12cm 寬 6cm，面積是周長的幾倍？', a: '2' },
  ]
  const apId = sid('area-perimeter')
  let apCount = await prisma.questionTemplate.count({ where: { skillId: apId } })
  if (apCount === 0) {
    for (const q of areaPerimQs) {
      await prisma.questionTemplate.create({ data: { skillId: apId, type: 'DIRECT', prompt: q.p, answer: q.a, explanation: '正方形周長=4×邊長，面積=邊長²；長方形周長=2×(長+寬)，面積=長×寬' } })
    }
    totalAdded += areaPerimQs.length
  }

  // ───────── G3: 四則混合 ─────────
  const mixOpsQs = [
    '3 + 5 × 2 = ?:13', '10 - 6 ÷ 2 = ?:7', '4 × 3 + 5 = ?:17', '20 ÷ 4 - 3 = ?:2',
    '6 + 4 × 2 = ?:14', '15 - 3 × 2 = ?:9', '12 ÷ 3 + 1 = ?:5', '8 + 8 ÷ 2 = ?:12',
    '7 × 2 - 5 = ?:9', '18 ÷ 3 + 4 = ?:10', '(3 + 5) × 2 = ?:16', '(10 - 2) ÷ 4 = ?:2',
    '(4 + 6) × 3 = ?:30', '(20 - 5) ÷ 5 = ?:3', '2 × (3 + 4) = ?:14',
  ]
  await addQuestions(sid('mixed-operations'), mixOpsQs, '')

  // ───────── G3: 分數初步 ─────────
  const fracIntroQs = [
    { p: '把蛋糕平分成 4 份，1 份是幾分之幾？', a: '1/4' },
    { p: '把圓平分成 8 份，3 份是幾分之幾？', a: '3/8' },
    { p: '1/2 和 1/3 哪個大？', a: '1/2' },
    { p: '1/4 + 2/4 = ?', a: '3/4' },
    { p: '3/5 - 1/5 = ?', a: '2/5' },
    { p: '2/3 和 3/4 哪個大？', a: '3/4' },
    { p: '5/8 + 2/8 = ?', a: '7/8' },
    { p: '7/9 - 4/9 = ?', a: '3/9' },
    { p: '1 又 1/2 = ?', a: '3/2' },
  ]
  const fiId = sid('fraction-intro')
  let fiCount = await prisma.questionTemplate.count({ where: { skillId: fiId } })
  if (fiCount === 0) {
    for (const q of fracIntroQs) {
      await prisma.questionTemplate.create({ data: { skillId: fiId, type: 'DIRECT', prompt: q.p, answer: q.a, explanation: '認識分數的基本概念與同分母分數加減' } })
    }
    totalAdded += fracIntroQs.length
  }

  // ───────── G4: 分數比較與加減 ─────────
  const fracCompQs = [
    '2/5 + 1/5 = ?:3/5', '5/8 - 3/8 = ?:2/8', '1/2 + 1/4 = ?:3/4', '3/4 - 1/2 = ?:1/4',
    '1/3 + 1/6 = ?:1/2', '約分 6/8 = ?:3/4', '4/10 化簡 = ?:2/5', '5/6 - 1/3 = ?:1/2', '2/3 + 1/6 = ?:5/6',
  ]
  await addQuestions(sid('fraction-compare'), fracCompQs, '')

  // ───────── G4: 小數初步 ─────────
  const decIntroQs = [
    '0.5 = ？分數:1/2', '0.25 = ？分數:1/4', '0.3 > 0.25 對嗎？:對', '0.7 + 0.2 = ?:0.9',
    '0.8 - 0.3 = ?:0.5', '1.5 = ？:1又1/2', '0.6 + 0.4 = ?:1.0', '0.9 - 0.6 = ?:0.3',
    '0.1 × 10 = ?:1', '3.2 > 2.8 對嗎？:對',
  ]
  await addQuestions(sid('decimal-intro'), decIntroQs, '')

  // ───────── G4: 大數乘法 ─────────
  const largeMulQs = [
    '23 × 4 = ?:92', '35 × 6 = ?:210', '42 × 7 = ?:294', '18 × 8 = ?:144',
    '56 × 5 = ?:280', '67 × 3 = ?:201', '29 × 4 = ?:116', '73 × 6 = ?:438',
    '44 × 7 = ?:308', '81 × 5 = ?:405', '38 × 9 = ?:342', '52 × 8 = ?:416',
    '15 × 12 = ?:180', '24 × 11 = ?:264',
  ]
  await addQuestions(sid('large-multiply'), largeMulQs, '')

  // ───────── G4: 大數認識 ─────────
  const largeNumQs = [
    { p: '10 個十是？', a: '100' }, { p: '10 個百是？', a: '1000' },
    { p: '2386 的「3」在什麼位？', a: '百位' }, { p: '5104 的「1」在什麼位？', a: '百位' },
    { p: '7000 + 300 + 50 + 2 = ?', a: '7352' }, { p: '8462 = 8000 + ? + 60 + 2', a: '400' },
    { p: '3520 < 5300 對嗎？', a: '對' }, { p: '9999 + 1 = ?', a: '10000' },
    { p: '6000 + 4000 = ?', a: '10000' }, { p: '最大的四位數是？', a: '9999' },
    { p: '最小的四位數是？', a: '1000' }, { p: '7890 ≈ ？（四捨五入到千位）', a: '8000' },
  ]
  const lnId = sid('large-numbers')
  let lnCount = await prisma.questionTemplate.count({ where: { skillId: lnId } })
  if (lnCount === 0) {
    for (const q of largeNumQs) {
      await prisma.questionTemplate.create({ data: { skillId: lnId, type: 'DIRECT', prompt: q.p, answer: q.a, explanation: '認識萬以內的數與位值' } })
    }
    totalAdded += largeNumQs.length
  }

  // ───────── G4: 三位數×兩位數 ─────────
  const threeByTwoQs = [
    '123 × 12 = ?:1476', '234 × 15 = ?:3510', '345 × 11 = ?:3795',
    '456 × 13 = ?:5928', '127 × 14 = ?:1778', '218 × 16 = ?:3488',
    '305 × 12 = ?:3660', '412 × 21 = ?:8652', '136 × 17 = ?:2312', '250 × 18 = ?:4500',
  ]
  await addQuestions(sid('three-by-two-mul'), threeByTwoQs, '')

  // ───────── G4: 兩位數除法 ─────────
  const twoDigDivQs = [
    '100 ÷ 25 = ?:4', '144 ÷ 12 = ?:12', '180 ÷ 15 = ?:12', '200 ÷ 20 = ?:10',
    '120 ÷ 12 = ?:10', '168 ÷ 14 = ?:12', '150 ÷ 25 = ?:6', '132 ÷ 11 = ?:12',
    '216 ÷ 18 = ?:12', '260 ÷ 13 = ?:20', '300 ÷ 15 = ?:20', '252 ÷ 14 = ?:18',
  ]
  await addQuestions(sid('two-digit-div'), twoDigDivQs, '')

  // ───────── G4: 運算規律 ─────────
  const arithQs = [
    '7 + 5 = 5 + ?:7', '(2 + 3) + 4 = 2 + (3 + ?):4',
    '3 × (5 + 2) = 3 × 5 + 3 × ?:2', '8 × (10 + 3) = 8 × 10 + 8 × ?:3',
    '6 + 8 + 4 = (6 + 4) + 8 = ?:18', '12 + 7 + 8 = (12 + 8) + 7 = ?:27',
    '25 × 4 = 100， 25 × 8 = ?:200', '4 × 13 × 25 = (4 × 25) × 13 = ?:1300',
    '99 × 7 + 99 = 99 × (7 + 1) = ?:792',
  ]
  await addQuestions(sid('arithmetic-laws'), arithQs, '')

  // ───────── G4: 小數性質 ─────────
  const decPropQs = [
    { p: '0.3 的位名是？', a: '十分位' }, { p: '0.45 的「4」在什麼位？', a: '十分位' },
    { p: '0.78 的「8」在什麼位？', a: '百分位' }, { p: '0.3 = 0.30 對嗎？', a: '對' },
    { p: '0.5 和 0.50 哪個大？', a: '一樣大' }, { p: '把 3.2 寫成小數：三又十分之二', a: '3.2' },
    { p: '0.6 > 0.58 對嗎？', a: '對' }, { p: '0.07 < 0.1 對嗎？', a: '對' },
    { p: '0.4 + 0.05 = ?', a: '0.45' }, { p: '將 0.8 寫成分數', a: '4/5' },
    { p: '將 0.25 寫成百分數', a: '25%' }, { p: '2.35 = 2 + 0.3 + ?', a: '0.05' },
  ]
  const dpId = sid('decimal-property')
  let dpCount = await prisma.questionTemplate.count({ where: { skillId: dpId } })
  if (dpCount === 0) {
    for (const q of decPropQs) {
      await prisma.questionTemplate.create({ data: { skillId: dpId, type: 'DIRECT', prompt: q.p, answer: q.a, explanation: '小數的位值、位名、大小比較與分數轉換' } })
    }
    totalAdded += decPropQs.length
  }

  // ───────── G4: 三角形 ─────────
  const triQs = [
    { p: '三角形有幾個角？', a: '3' }, { p: '三角形三個角的和是多少度？', a: '180' },
    { p: '兩邊一樣長的三角形叫？', a: '等腰三角形' }, { p: '三邊一樣長的三角形叫？', a: '正三角形' },
    { p: '有一個角是直角三角形的叫？', a: '直角三角形' }, { p: '等腰三角形的底角會怎麼樣？', a: '相等' },
    { p: '三角形中，最大角是 90 度，這是什麼三角形？', a: '直角三角形' },
    { p: '正三角形的每個角 = ? 度', a: '60' }, { p: '三角形有幾條邊？', a: '3' },
  ]
  const triId = sid('triangle')
  let triCount = await prisma.questionTemplate.count({ where: { skillId: triId } })
  if (triCount === 0) {
    for (const q of triQs) {
      await prisma.questionTemplate.create({ data: { skillId: triId, type: 'DIRECT', prompt: q.p, answer: q.a, explanation: '三角形分類、內角和 180°' } })
    }
    totalAdded += triQs.length
  }

  // ───────── G4: 面積 ─────────
  const areaIntroQs = [
    '正方形邊長 5cm，面積？:25', '長方形 6×4cm，面積？:24', '正方形邊長 8cm，面積？:64',
    '長方形 9×3cm，面積？:27', '長方形 12×5cm，面積？:60', '正方形邊長 7cm，面積？:49',
    '長方形 10×6cm，面積？:60', '正方形邊長 2cm，面積？:4',
  ]
  await addQuestions(sid('area-intro'), areaIntroQs, '')

  // ───────── G4: 直式除法 ─────────
  const longDivQs = [
    '240 ÷ 6 = ?:40', '368 ÷ 4 = ?:92', '525 ÷ 5 = ?:105', '100 ÷ 4 = ?:25',
    '180 ÷ 6 = ?:30', '720 ÷ 8 = ?:90', '300 ÷ 5 = ?:60', '567 ÷ 7 = ?:81',
    '144 ÷ 6 = ?:24', '810 ÷ 9 = ?:90',
  ]
  await addQuestions(sid('long-division'), longDivQs, '')

  // ───────── G5: 小數加減法 ─────────
  const decOpsQs = [
    '1.5 + 2.3 = ?:3.8', '4.7 - 1.2 = ?:3.5', '3.6 + 2.8 = ?:6.4', '5.4 - 2.9 = ?:2.5',
    '12.5 + 7.3 = ?:19.8', '8.6 - 3.7 = ?:4.9', '0.75 + 0.25 = ?:1.0', '6.3 - 4.8 = ?:1.5',
    '7.2 + 1.9 = ?:9.1', '10.0 - 3.6 = ?:6.4', '2.45 + 3.55 = ?:6.0', '9.1 - 5.6 = ?:3.5',
    '4.8 + 5.2 = ?:10.0', '15.6 - 7.8 = ?:7.8',
  ]
  await addQuestions(sid('decimal-operations'), decOpsQs, '對齊小數點計算：')

  // ───────── G5: 分數的加減運算與性質 ─────────
  const fracOpsQs = [
    '1/3 + 1/4 = ?:7/12', '2/5 + 1/3 = ?:11/15', '3/4 - 1/3 = ?:5/12', '1/2 + 1/5 = ?:7/10',
    '5/6 - 1/2 = ?:1/3', '2/3 + 1/5 = ?:13/15', '7/8 - 1/4 = ?:5/8', '3/10 + 1/2 = ?:4/5',
  ]
  await addQuestions(sid('fraction-operations'), fracOpsQs, '異分母分數加減：先通分再計算：')

  // ───────── G5: 小數乘除法 ─────────
  const decMulDivQs = [
    '0.3 × 4 = ?:1.2', '2.5 × 3 = ?:7.5', '1.2 × 5 = ?:6.0', '4.8 ÷ 2 = ?:2.4',
    '6.3 ÷ 3 = ?:2.1', '0.5 × 6 = ?:3.0', '1.5 × 4 = ?:6.0', '7.2 ÷ 8 = ?:0.9',
    '3.6 ÷ 4 = ?:0.9', '0.8 × 7 = ?:5.6', '2.4 × 2 = ?:4.8', '5.5 ÷ 5 = ?:1.1',
    '0.6 × 9 = ?:5.4', '9.9 ÷ 3 = ?:3.3', '1.8 × 5 = ?:9.0',
  ]
  await addQuestions(sid('decimal-multiply-divide'), decMulDivQs, '小數乘除法：')

  // ───────── G5: 體積（長方體與正方體） ─────────
  const volIntroQs = [
    '長方體 5×3×2cm，體積？:30', '正方體邊長 4cm，體積？:64', '長方體 6×2×3cm，體積？:36',
    '正方體邊長 2cm，體積？:8', '長方體 10×4×3cm，體積？:120', '正方體邊長 6cm，表面積？:216',
    '正方體邊長 3cm，體積？:27', '長方體 4×4×6cm，體積？:96', '正方體邊長 5cm，表面積？:150',
    '長方體 7×3×4cm，體積？:84', '正方體邊長 10cm，體積？:1000', '長方體 8×5×3cm，容積？:120',
  ]
  await addQuestions(sid('volume-intro'), volIntroQs, '體積=長×寬×高，表面積=6×邊長²：')

  // ───────── G6: 比與比例 ─────────
  const ratioQs = [
    '化簡比 6:8 = ?:3:4', '化簡比 10:15 = ?:2:3', 'a:b=2:5, a=6, b=?:15',
    '12:18 化簡 = ?:2:3', '3:7 = 9:?:21', '4:5 = ?:25:20',
    '化簡 24:36 = ?:2:3', '化簡 15:25 = ?:3:5',
  ]
  await addQuestions(sid('ratio'), ratioQs, '')

  // ───────── G6: 百分比 ─────────
  const percentQs = [
    '0.5 = ?%:50%', '1/4 = ?%:25%', '3/4 = ?%:75%', '200 元打 8 折 = ?:160',
    '40 人×60%女生 = ?人:24', '0.75 = ?%:75%', '1/10 = ?%:10%', '500 元打 7 折 = ?:350',
    '10000×2%利息 = ?:200', '2/5 = ?%:40%', '1/8 = ?%:12.5%', '300→240 元是幾折？:8折',
  ]
  await addQuestions(sid('percent'), percentQs, '')

  // ───────── G6: 圓 ─────────
  const circleQs = [
    { p: '半徑 7cm 直徑？', a: '14' }, { p: '直徑 10cm 半徑？', a: '5' },
    { p: '半徑 5cm 周長？(π=3.14)', a: '31.4' }, { p: '半徑 3cm 面積？(π=3.14)', a: '28.26' },
    { p: '直徑 8cm 周長？(π=3.14)', a: '25.12' }, { p: '半徑 4cm 面積？(π=3.14)', a: '50.24' },
    { p: '半徑 6cm 周長？(π=3.14)', a: '37.68' }, { p: '半徑 2cm 面積？(π=3.14)', a: '12.56' },
    { p: '直徑 14cm 半徑？', a: '7' }, { p: '半徑 10cm 周長？(π=3.14)', a: '62.8' },
    { p: '圓的定義：到定點等距離的點所形成的圖形，定點稱為？', a: '圓心' },
    { p: '連接圓心和圓上任意一點的線段叫？', a: '半徑' },
    { p: '通過圓心且兩端在圓上的線段叫？', a: '直徑' },
    { p: '直徑是半徑的幾倍？', a: '2' },
    { p: '圓周率 π 大約等於？', a: '3.14' },
    { p: '圓周率是圓的什麼除以直徑？', a: '圓周長' },
    { p: '半徑 8cm 直徑？', a: '16' }, { p: '直徑 20cm 半徑？', a: '10' },
    { p: '半徑 9cm 周長？(π=3.14)', a: '56.52' }, { p: '直徑 12cm 周長？(π=3.14)', a: '37.68' },
    { p: '半徑 1cm 面積？(π=3.14)', a: '3.14' }, { p: '直徑 6cm 面積？(π=3.14)', a: '28.26' },
    { p: '半徑 0.5cm 周長？(π=3.14)', a: '3.14' }, { p: '圓面積公式是？', a: 'πr²' },
  ]
  const cId = sid('circle')
  let cCount = await prisma.questionTemplate.count({ where: { skillId: cId } })
  if (cCount === 0) {
    for (const q of circleQs) {
      await prisma.questionTemplate.create({ data: { skillId: cId, type: 'DIRECT', prompt: q.p, answer: q.a, explanation: '圓的定義：到圓心等距的點集合；圓周長=2πr=πd，圓面積=πr²' } })
    }
    totalAdded += circleQs.length
  }

  // ───────── G6: 速率 ─────────
  const speedQs = [
    '3h 走 180km 速率？:60', '12km/h×2h 距離？:24', '200km÷50km/h 時間？:4',
    '80km/h×4h 距離？:320', '150km÷75km/h 時間？:2', '5km/h×1.5h 距離？:7.5',
    '300km÷5h 速率？:60', '60km/h×3.5h 距離？:210', '30min 跑 6km 速率？:12',
    '420km÷70km/h 時間？:6',
  ]
  await addQuestions(sid('speed'), speedQs, '')

  // ───────── G6: 柱體體積 ─────────
  const prismVolQs = [
    '圓柱半徑 3cm 高 5cm 體積？(π=3.14):141.3',
    '三角柱底 20cm² 高 8cm 體積？:160',
    '圓柱半徑 4cm 高 6cm 體積？(π=3.14):301.44',
    '圓柱半徑 2cm 高 10cm 體積？(π=3.14):125.6',
    '柱體底 15cm² 高 12cm 體積？:180',
    '圓柱半徑 5cm 高 4cm 體積？(π=3.14):314',
    '圓柱半徑 1cm 高 7cm 體積？(π=3.14):21.98',
    '三角柱底 24cm² 高 5cm 體積？:120',
  ]
  await addQuestions(sid('prism-volume'), prismVolQs, '')

  // 最終統計
  console.log(`\n📊 共還原 ${totalAdded} 題 G3-G6 題目`)
  const allCount = await prisma.questionTemplate.count()
  console.log(`📊 全平台題目總數：${allCount}`)
  console.log('\n✅ 還原完成！')

  async function addQuestions(skillId: string, qs: string[], prefix: string) {
    const count = await prisma.questionTemplate.count({ where: { skillId } })
    if (count > 0) return
    for (const q of qs) {
      const [prompt, answer] = q.split(':')
      await prisma.questionTemplate.create({
        data: { skillId, type: 'DIRECT', prompt, answer, explanation: prefix ? `${prefix}${prompt.replace(' = ?', '')} = ${answer}` : `${prompt.replace(' = ?', '')} = ${answer}` },
      })
    }
    totalAdded += qs.length
  }
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
