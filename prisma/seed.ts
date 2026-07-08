import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding...')

  // ============ 管理員帳號 ============
  // 安全：不再使用寫死的弱密碼（admin123）帶到正式環境。
  //   - 開發環境：未設定 ADMIN_PASSWORD 時，沿用方便的 admin123。
  //   - 正式環境：必須設定 ADMIN_PASSWORD；否則自動產生一次性隨機密碼並印出，
  //     且明確拒絕 admin123 / 過短密碼。
  //   - update: {} 表示已存在的管理員「不會」被重新設密碼（避免覆蓋已改過的密碼）。
  const isProd = process.env.NODE_ENV === 'production'
  const envAdminPassword = process.env.ADMIN_PASSWORD?.trim()

  function randomPassword(bytes = 18): string {
    // crypto.random 轉 base64url，去掉易混淆字元
    const { randomBytes } = await import('crypto')
    return randomBytes(bytes)
      .toString('base64url')
      .replace(/[Il1O0]/g, 'x')
      .slice(0, 24)
  }

  let adminPassword: string
  if (envAdminPassword && envAdminPassword.length >= 8 && envAdminPassword !== 'admin123') {
    adminPassword = envAdminPassword
  } else if (isProd) {
    adminPassword = randomPassword()
    console.warn('')
    console.warn('⚠️  正式環境未設定安全的 ADMIN_PASSWORD，已自動產生一次性隨機密碼：')
    console.warn(`    👉 ${adminPassword}`)
    console.warn('    請立即登入後修改密碼，或設定 ADMIN_PASSWORD 環境變數後重新 seed。')
    console.warn('')
  } else {
    // 開發環境預設密碼（僅限 dev）
    adminPassword = envAdminPassword || 'admin123'
  }

  const adminHash = await bcrypt.hash(adminPassword, 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@math.local' },
    update: {},
    create: {
      email: 'admin@math.local',
      name: '管理員',
      passwordHash: adminHash,
      role: 'ADMIN',
    },
  })
  const adminDisplay = isProd && !envAdminPassword ? '(隨機密碼，見上方)' : adminPassword
  console.log(`  ✓ Admin: ${admin.email} / ${adminDisplay}`)

  // ============ 技能（K-2 數感與計算）============
  // order 重新編排以容納新技能
  const countObjects = await prisma.skill.upsert({
    where: { code: 'count-objects' },
    update: { order: 0 },
    create: {
      code: 'count-objects',
      name: '數數',
      description: '數出物品的個數，認識數字 1-10',
      gradeLevel: 'K',
      order: 0,
    },
  })

  const shapeRecognition = await prisma.skill.upsert({
    where: { code: 'shape-recognition' },
    update: { order: 1, prerequisiteId: countObjects.id },
    create: {
      code: 'shape-recognition',
      name: '圖形辨認',
      description: '認識基本平面圖形：正方形、圓形、三角形、長方形',
      gradeLevel: 'K',
      order: 1,
      prerequisiteId: countObjects.id,
    },
  })

  const countCompare = await prisma.skill.upsert({
    where: { code: 'count-compare' },
    update: { order: 2 },
    create: {
      code: 'count-compare',
      name: '數量比較',
      description: '比較兩組物品或兩個數的大小',
      gradeLevel: 'K',
      order: 2,
    },
  })

  const addWithin10 = await prisma.skill.upsert({
    where: { code: 'add-within-10' },
    update: { order: 3, prerequisiteId: countCompare.id },
    create: {
      code: 'add-within-10',
      name: '10 以內加法',
      description: '兩數相加，和不超過 10',
      gradeLevel: 'G1',
      order: 3,
      prerequisiteId: countCompare.id,
    },
  })

  const subWithin10 = await prisma.skill.upsert({
    where: { code: 'sub-within-10' },
    update: { order: 4, prerequisiteId: addWithin10.id },
    create: {
      code: 'sub-within-10',
      name: '10 以內減法',
      description: '兩數相減，差不為負',
      gradeLevel: 'G1',
      order: 4,
      prerequisiteId: addWithin10.id,
    },
  })

  const addWithin20 = await prisma.skill.upsert({
    where: { code: 'add-within-20' },
    update: { order: 5, prerequisiteId: addWithin10.id },
    create: {
      code: 'add-within-20',
      name: '20 以內加法',
      description: '兩數相加，和不超過 20',
      gradeLevel: 'G1',
      order: 5,
      prerequisiteId: addWithin10.id,
    },
  })

  const wordProblem = await prisma.skill.upsert({
    where: { code: 'word-problem' },
    update: { order: 6, prerequisiteId: subWithin10.id },
    create: {
      code: 'word-problem',
      name: '簡單文字題',
      description: '生活情境的加減應用',
      gradeLevel: 'G2',
      order: 6,
      prerequisiteId: subWithin10.id,
    },
  })

  // ============ G2 乘法與除法技能 ============
  const introMultiply = await prisma.skill.upsert({
    where: { code: 'intro-multiply' },
    update: { order: 7, prerequisiteId: addWithin20.id },
    create: {
      code: 'intro-multiply',
      name: '乘法入門',
      description: '用連加概念引入乘法，2-5 的九九乘法',
      gradeLevel: 'G2',
      order: 7,
      prerequisiteId: addWithin20.id,
    },
  })

  const multiply69 = await prisma.skill.upsert({
    where: { code: 'multiply-6-9' },
    update: { order: 8, prerequisiteId: introMultiply.id },
    create: {
      code: 'multiply-6-9',
      name: '6-9 的乘法',
      description: '6×1 到 9×9 的乘法練習',
      gradeLevel: 'G2',
      order: 8,
      prerequisiteId: introMultiply.id,
    },
  })

  const multiplyTable = await prisma.skill.upsert({
    where: { code: 'multiply-table' },
    update: { order: 9, prerequisiteId: multiply69.id },
    create: {
      code: 'multiply-table',
      name: '九九乘法練習',
      description: '綜合九九乘法隨機練習',
      gradeLevel: 'G2',
      order: 9,
      prerequisiteId: multiply69.id,
    },
  })

  const introDivide = await prisma.skill.upsert({
    where: { code: 'intro-divide' },
    update: { order: 10, prerequisiteId: introMultiply.id },
    create: {
      code: 'intro-divide',
      name: '除法入門',
      description: '用平分概念引入除法',
      gradeLevel: 'G2',
      order: 10,
      prerequisiteId: introMultiply.id,
    },
  })

  const divideBasic = await prisma.skill.upsert({
    where: { code: 'divide-basic' },
    update: { order: 11, prerequisiteId: introDivide.id },
    create: {
      code: 'divide-basic',
      name: '基礎除法',
      description: '能整除的簡單除法練習',
      gradeLevel: 'G2',
      order: 11,
      prerequisiteId: introDivide.id,
    },
  })

  // ============ G3 橋接技能：進階四則運算與分數初步 ============
  const addSub100 = await prisma.skill.upsert({
    where: { code: 'add-sub-100' },
    update: { order: 12, prerequisiteId: divideBasic.id },
    create: {
      code: 'add-sub-100',
      name: '百以內加減',
      description: '兩位數加減法，進位與借位練習',
      gradeLevel: 'G3',
      order: 12,
      prerequisiteId: divideBasic.id,
    },
  })

  const multiplyAdvanced = await prisma.skill.upsert({
    where: { code: 'multiply-advanced' },
    update: { order: 13, prerequisiteId: addSub100.id },
    create: {
      code: 'multiply-advanced',
      name: '乘法進階',
      description: '一位數×兩位數、乘法應用',
      gradeLevel: 'G3',
      order: 13,
      prerequisiteId: addSub100.id,
    },
  })

  const divideAdvanced = await prisma.skill.upsert({
    where: { code: 'divide-advanced' },
    update: { order: 14, prerequisiteId: multiplyAdvanced.id },
    create: {
      code: 'divide-advanced',
      name: '除法進階',
      description: '兩位數除以一位數、有餘數的除法',
      gradeLevel: 'G3',
      order: 14,
      prerequisiteId: multiplyAdvanced.id,
    },
  })

  // ─── G3 擴充空技能 ───
  const threeDigitAddSub = await prisma.skill.upsert({
    where: { code: 'three-digit-add-sub' },
    update: { order: 15 },
    create: {
      code: 'three-digit-add-sub',
      name: '三位數加減',
      description: '三位數的加法與減法，進位與借位',
      gradeLevel: 'G3',
      order: 15,
    },
  })

  const introFraction = await prisma.skill.upsert({
    where: { code: 'intro-fraction' },
    update: { order: 16 },
    create: {
      code: 'intro-fraction',
      name: '分數基礎',
      description: '分數的單位分數、分數數線與等值分數',
      gradeLevel: 'G3',
      order: 16,
    },
  })

  const timeCalc = await prisma.skill.upsert({
    where: { code: 'time-calc' },
    update: { order: 17 },
    create: {
      code: 'time-calc',
      name: '時間計算',
      description: '時間單位換算、經過時間的計算',
      gradeLevel: 'G3',
      order: 17,
    },
  })

  const areaPerimeter = await prisma.skill.upsert({
    where: { code: 'area-perimeter' },
    update: { order: 18 },
    create: {
      code: 'area-perimeter',
      name: '面積與周長',
      description: '正方形與長方形的面積和周長計算',
      gradeLevel: 'G3',
      order: 18,
    },
  })

  const mixedOps = await prisma.skill.upsert({
    where: { code: 'mixed-operations' },
    update: { order: 19, prerequisiteId: divideAdvanced.id },
    create: {
      code: 'mixed-operations',
      name: '四則混合',
      description: '加減乘除混合運算，先乘除後加減',
      gradeLevel: 'G3',
      order: 19,
      prerequisiteId: divideAdvanced.id,
    },
  })

  const fractionIntro = await prisma.skill.upsert({
    where: { code: 'fraction-intro' },
    update: { order: 20, prerequisiteId: mixedOps.id },
    create: {
      code: 'fraction-intro',
      name: '分數初步',
      description: '認識分數、真分數、帶分數與簡單分數比較',
      gradeLevel: 'G3',
      order: 20,
      prerequisiteId: mixedOps.id,
    },
  })

  // ============ G4 橋接技能：分數與小數 ============
  const fractionCompare = await prisma.skill.upsert({
    where: { code: 'fraction-compare' },
    update: { order: 17, prerequisiteId: fractionIntro.id },
    create: {
      code: 'fraction-compare',
      name: '分數比較與加減',
      description: '同分母分數比較、加減與帶分數轉換',
      gradeLevel: 'G4',
      order: 17,
      prerequisiteId: fractionIntro.id,
    },
  })

  const decimalIntro = await prisma.skill.upsert({
    where: { code: 'decimal-intro' },
    update: { order: 18, prerequisiteId: fractionCompare.id },
    create: {
      code: 'decimal-intro',
      name: '小數初步',
      description: '認識小數、小數的位值、小數比大小',
      gradeLevel: 'G4',
      order: 18,
      prerequisiteId: fractionCompare.id,
    },
  })

  // ─── G4 擴充空技能 ───
  const largeMultiply = await prisma.skill.upsert({
    where: { code: 'large-multiply' },
    update: { order: 21 },
    create: {
      code: 'large-multiply',
      name: '大數乘法',
      description: '兩位數×一位數、進位乘法',
      gradeLevel: 'G4',
      order: 21,
    },
  })

  const largeNumbers = await prisma.skill.upsert({
    where: { code: 'large-numbers' },
    update: { order: 22 },
    create: {
      code: 'large-numbers',
      name: '大數認識',
      description: '萬以內的數、位值與大小比較',
      gradeLevel: 'G4',
      order: 22,
    },
  })

  const threeByTwoMul = await prisma.skill.upsert({
    where: { code: 'three-by-two-mul' },
    update: { order: 23 },
    create: {
      code: 'three-by-two-mul',
      name: '三位數×兩位數',
      description: '三位數乘以兩位數的直式計算',
      gradeLevel: 'G4',
      order: 23,
    },
  })

  const twoDigitDiv = await prisma.skill.upsert({
    where: { code: 'two-digit-div' },
    update: { order: 24 },
    create: {
      code: 'two-digit-div',
      name: '兩位數除法',
      description: '三位數除以兩位數的直式計算',
      gradeLevel: 'G4',
      order: 24,
    },
  })

  const arithmeticLaws = await prisma.skill.upsert({
    where: { code: 'arithmetic-laws' },
    update: { order: 25 },
    create: {
      code: 'arithmetic-laws',
      name: '運算規律',
      description: '加法交換律、結合律與乘法分配律',
      gradeLevel: 'G4',
      order: 25,
    },
  })

  const decimalProperty = await prisma.skill.upsert({
    where: { code: 'decimal-property' },
    update: { order: 26 },
    create: {
      code: 'decimal-property',
      name: '小數性質',
      description: '小數的位值、位名與大小比較',
      gradeLevel: 'G4',
      order: 26,
    },
  })

  const triangle = await prisma.skill.upsert({
    where: { code: 'triangle' },
    update: { order: 27 },
    create: {
      code: 'triangle',
      name: '三角形',
      description: '三角形的分類（等腰、正三角形）與角度和',
      gradeLevel: 'G4',
      order: 27,
    },
  })

  const areaIntro = await prisma.skill.upsert({
    where: { code: 'area-intro' },
    update: { order: 19 },
    create: {
      code: 'area-intro',
      name: '面積',
      description: '正方形和長方形的面積公式與應用',
      gradeLevel: 'G4',
      order: 19,
    },
  })

  const longDivision = await prisma.skill.upsert({
    where: { code: 'long-division' },
    update: { order: 20, prerequisiteId: decimalIntro.id },
    create: {
      code: 'long-division',
      name: '直式除法',
      description: '三位數除以一位數的直式計算與應用',
      gradeLevel: 'G4',
      order: 20,
      prerequisiteId: decimalIntro.id,
    },
  })

  // ============ G5 小數與分數進階 ============
  const decimalOps = await prisma.skill.upsert({
    where: { code: 'decimal-operations' },
    update: { order: 21, prerequisiteId: decimalIntro.id },
    create: {
      code: 'decimal-operations',
      name: '小數加減法',
      description: '小數的加法和減法，對齊小數點',
      gradeLevel: 'G5',
      order: 21,
      prerequisiteId: decimalIntro.id,
    },
  })

  const fractionOps = await prisma.skill.upsert({
    where: { code: 'fraction-operations' },
    update: { order: 22, prerequisiteId: fractionCompare.id },
    create: {
      code: 'fraction-operations',
      name: '分數的加減運算與性質',
      description: '異分母分數加減、通分、約分與分數的基本性質',
      gradeLevel: 'G5',
      order: 22,
      prerequisiteId: fractionCompare.id,
    },
  })

  const decimalMulDiv = await prisma.skill.upsert({
    where: { code: 'decimal-multiply-divide' },
    update: { order: 23, prerequisiteId: decimalOps.id },
    create: {
      code: 'decimal-multiply-divide',
      name: '小數乘除法',
      description: '小數乘以整數、小數除以整數的計算',
      gradeLevel: 'G5',
      order: 23,
      prerequisiteId: decimalOps.id,
    },
  })

  const volumeIntro = await prisma.skill.upsert({
    where: { code: 'volume-intro' },
    update: { order: 25 },
    create: {
      code: 'volume-intro',
      name: '體積（長方體與正方體）',
      description: '長方體和正方體的體積公式、表面積與應用',
      gradeLevel: 'G5',
      order: 25,
    },
  })

  // ============ G5 新技能：方程、多邊形公式、因數倍數 ============
  const equation = await prisma.skill.upsert({
    where: { code: 'equation' },
    update: { order: 26, prerequisiteId: decimalMulDiv.id },
    create: {
      code: 'equation',
      name: '方程',
      description: '用字母表示數、一元一次方程的解法與應用',
      gradeLevel: 'G5',
      order: 26,
      prerequisiteId: decimalMulDiv.id,
    },
  })

  const polygonFormula = await prisma.skill.upsert({
    where: { code: 'polygon-formula' },
    update: { order: 27, prerequisiteId: areaIntro.id },
    create: {
      code: 'polygon-formula',
      name: '多邊形的公式計算',
      description: '平行四邊形、三角形、梯形的面積公式推導與計算',
      gradeLevel: 'G5',
      order: 27,
      prerequisiteId: areaIntro.id,
    },
  })

  const factorsMultiples = await prisma.skill.upsert({
    where: { code: 'factors-multiples' },
    update: { order: 28, prerequisiteId: decimalMulDiv.id },
    create: {
      code: 'factors-multiples',
      name: '因數與倍數',
      description: '因數、倍數、質數、合數、最大公因數、最小公倍數',
      gradeLevel: 'G5',
      order: 28,
      prerequisiteId: decimalMulDiv.id,
    },
  })

  // ============ G6 分數乘除法、比例、百分比與幾何 ============
  const fractionMulDiv = await prisma.skill.upsert({
    where: { code: 'fraction-multiply-divide' },
    update: { order: 29, prerequisiteId: fractionOps.id },
    create: {
      code: 'fraction-multiply-divide',
      name: '分數乘除法',
      description: '分數乘以分數、分數除以分數的計算與應用',
      gradeLevel: 'G6',
      order: 29,
      prerequisiteId: fractionOps.id,
    },
  })

  const ratio = await prisma.skill.upsert({
    where: { code: 'ratio' },
    update: { order: 30, prerequisiteId: fractionMulDiv.id },
    create: {
      code: 'ratio',
      name: '比與比例',
      description: '比的意義、化簡比、比例式的應用',
      gradeLevel: 'G6',
      order: 30,
      prerequisiteId: fractionMulDiv.id,
    },
  })

  const percent = await prisma.skill.upsert({
    where: { code: 'percent' },
    update: { order: 31, prerequisiteId: ratio.id },
    create: {
      code: 'percent',
      name: '百分比',
      description: '百分率、百分比的計算、折扣與加成',
      gradeLevel: 'G6',
      order: 31,
      prerequisiteId: ratio.id,
    },
  })

  const circle = await prisma.skill.upsert({
    where: { code: 'circle' },
    update: { order: 32 },
    create: {
      code: 'circle',
      name: '圓',
      description: '圓的定義、圓周率、圓周長與圓面積的計算',
      gradeLevel: 'G6',
      order: 32,
    },
  })

  const speed = await prisma.skill.upsert({
    where: { code: 'speed' },
    update: { order: 33, prerequisiteId: ratio.id },
    create: {
      code: 'speed',
      name: '速率',
      description: '速度、距離、時間的關係與計算',
      gradeLevel: 'G6',
      order: 33,
      prerequisiteId: ratio.id,
    },
  })

  const prismVolume = await prisma.skill.upsert({
    where: { code: 'prism-volume' },
    update: { order: 34, prerequisiteId: volumeIntro.id },
    create: {
      code: 'prism-volume',
      name: '柱體體積',
      description: '圓柱與角柱的體積計算',
      gradeLevel: 'G6',
      order: 34,
      prerequisiteId: volumeIntro.id,
    },
  })

  // ============ G6 新技能：負數、圓錐與圓柱 ============
  const negativeNumbers = await prisma.skill.upsert({
    where: { code: 'negative-numbers' },
    update: { order: 35 },
    create: {
      code: 'negative-numbers',
      name: '負數',
      description: '負數的認識、數線、絕對值及簡單的加減運算',
      gradeLevel: 'G6',
      order: 35,
    },
  })

  const coneCylinder = await prisma.skill.upsert({
    where: { code: 'cone-cylinder' },
    update: { order: 36, prerequisiteId: circle.id },
    create: {
      code: 'cone-cylinder',
      name: '圓錐與圓柱',
      description: '圓柱的表面積與體積、圓錐的體積計算公式與應用',
      gradeLevel: 'G6',
      order: 36,
      prerequisiteId: circle.id,
    },
  })

  // ============ 題目模板 ============
  // 必須按外鍵依賴順序清除，避免 SQLite 外鍵約束錯誤
  await prisma.attempt.deleteMany({})
  await prisma.practiceSession.deleteMany({})
  await prisma.masterySnapshot.deleteMany({})
  await prisma.questionTemplate.deleteMany({})

  // ───────── 1. 數數（count-objects）: 20+ 題 ─────────
  const countSymbols = ['★', '●', '■', '◆', '▲', '♥', '⬟', '⬢']
  const countQuestions: { prompt: string; answer: string; options: string }[] = []
  for (let n = 3; n <= 10; n++) {
    const symbol = countSymbols[(n - 3) % countSymbols.length]
    const symbols = Array.from({ length: n }, () => symbol).join(' ')
    const distractor1 = Math.max(1, n - 1)
    const distractor2 = Math.min(10, n + 1)
    countQuestions.push({
      prompt: `數一數：${symbols} 有幾個？`,
      answer: String(n),
      options: `${distractor1},${n},${distractor2}`,
    })
  }
  // 補充變化：不同符號混合
  countQuestions.push(
    { prompt: '數一數：★ ★ ★ ★ ★ ★ ★ 有幾個？', answer: '7', options: '6,7,8' },
    { prompt: '數一數：● ● ● ● ● 有幾個？', answer: '5', options: '4,5,6' },
    { prompt: '數一數：■ ■ ■ ■ ■ ■ ■ ■ 有幾個？', answer: '8', options: '7,8,9' },
    { prompt: '數一數：◆ ◆ ◆ ◆ 有幾個？', answer: '4', options: '3,4,5' },
    { prompt: '數一數：▲ ▲ ▲ ▲ ▲ ▲ 有幾個？', answer: '6', options: '5,6,7' },
    { prompt: '數一數：♥ ♥ ♥ 有幾個？', answer: '3', options: '2,3,4' },
    { prompt: '數一數：● ● ● ● ● ● ● ● ● 有幾個？', answer: '9', options: '8,9,10' },
    { prompt: '數一數：■ ■ ■ ■ ■ ■ ■ ■ ■ ■ 有幾個？', answer: '10', options: '9,10,8' },
    { prompt: '數一數：◆ ◆ 有幾個？', answer: '2', options: '1,2,3' },
    { prompt: '數一數：▲ 有幾個？', answer: '1', options: '0,1,2' },
    { prompt: '數一數：♥ ♥ ♥ ♥ ♥ ♥ ♥ ♥ 有幾個？', answer: '8', options: '7,8,9' },
    { prompt: '● ● ● ● ● ● 共有幾個●？', answer: '6', options: '5,6,7' },
  )
  for (const q of countQuestions) {
    await prisma.questionTemplate.create({
      data: {
        skillId: countObjects.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        options: q.options,
        explanation: `一個一個數，總共有 ${q.answer} 個`,
      },
    })
  }

  // ───────── 2. 圖形辨認（shape-recognition）: 15+ 題 ─────────
  const shapeDefinitions = [
    // symbol 改用 [shape:xxx] 標記，前端 renderTextWithShapes 會渲染成彩色 SVG
    // （紅正方/藍圓/綠三角/橙長方），比 Unicode 符號清晰且跨裝置一致
    { symbol: '[shape:square]', name: '正方形', feature: '四條邊一樣長，四個角都是直角' },
    { symbol: '[shape:circle]', name: '圓形', feature: '圓圓的，沒有角也沒有邊' },
    { symbol: '[shape:triangle]', name: '三角形', feature: '有三條邊和三個角' },
    { symbol: '[shape:rectangle]', name: '長方形', feature: '有四條邊，對邊一樣長，四個角都是直角' },
  ]
  const allShapeNames = ['正方形', '圓形', '三角形', '長方形']

  for (const shape of shapeDefinitions) {
    // 每種形狀出 4 題，用不同問法
    const others = allShapeNames.filter((n) => n !== shape.name)
    const shuffleOthers = (arr: string[]) => {
      const a = [...arr]
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      return a
    }

    const variants = [
      {
        prompt: `這是什麼形狀？${shape.symbol}`,
        options: [...shuffleOthers(others).slice(0, 3), shape.name].sort(() => Math.random() - 0.5).join(','),
      },
      {
        prompt: `下面哪一個是${shape.name}？`,
        answer: shape.name,
        options: [shape.name, ...shuffleOthers(others).slice(0, 2)].sort(() => Math.random() - 0.5).join(','),
      },
      {
        prompt: `指一指：${shape.symbol} 是什麼形狀？`,
        options: [shape.name, ...shuffleOthers(others).slice(0, 3)].sort(() => Math.random() - 0.5).join(','),
      },
      {
        prompt: `${shape.symbol} 這個圖形叫什麼？`,
        options: [...shuffleOthers(others).slice(0, 3), shape.name].sort(() => Math.random() - 0.5).join(','),
      },
    ]
    for (const v of variants) {
      await prisma.questionTemplate.create({
        data: {
          skillId: shapeRecognition.id,
          type: 'DIRECT',
          prompt: v.prompt,
          answer: shape.name,
          options: v.options,
          explanation: `${shape.symbol} 是${shape.name}，${shape.feature}`,
        },
      })
    }
  }

  // ───────── 3. 數量比較（count-compare）: 擴充至 25 題 ─────────
  const compareQuestions = [
    { prompt: '哪一個比較多？3 和 8', answer: '8', options: '3,8' },
    { prompt: '哪一個比較大？7 和 4', answer: '7', options: '7,4' },
    { prompt: '哪一個比較少？5 和 2', answer: '2', options: '5,2' },
    { prompt: '哪一個比較小？9 和 6', answer: '6', options: '9,6' },
    { prompt: '哪一個比較多？10 和 1', answer: '10', options: '10,1' },
    { prompt: '★ ★ ★ ★ ★ 和 ● ● ●，哪一邊比較多？', answer: '★', options: '★,●,一樣多' },
    { prompt: '■ ■ ■ 和 ◆ ◆ ◆ ◆ ◆，哪一邊比較多？', answer: '◆', options: '■,◆,一樣多' },
    { prompt: '▲ ▲ ▲ ▲ 和 ● ● ● ●，哪一邊比較多？', answer: '一樣多', options: '▲,●,一樣多' },
    { prompt: '哪一個數字最大？2, 9, 5', answer: '9', options: '2,9,5' },
    { prompt: '哪一個數字最小？8, 3, 6', answer: '3', options: '8,3,6' },
    { prompt: '7 和 10，哪一個比較大？', answer: '10', options: '7,10' },
    { prompt: '0 和 5，哪一個比較小？', answer: '0', options: '0,5' },
    { prompt: '4 和 9，哪一個比較大？', answer: '9', options: '4,9' },
    { prompt: '1 和 6，哪一個比較小？', answer: '1', options: '1,6' },
    { prompt: '8 和 2，哪一個比較大？', answer: '8', options: '8,2' },
    { prompt: '3 和 3，哪一個比較大？', answer: '一樣大', options: '3,一樣大,右邊的3' },
    { prompt: '★★★ 和 ★★★★★，哪邊比較多？', answer: '右邊', options: '左邊,右邊,一樣多' },
    { prompt: '♥ ♥ 和 ♥ ♥ ♥ ♥，哪一邊比較多？', answer: '♥ ♥ ♥ ♥', options: '♥ ♥,♥ ♥ ♥ ♥,一樣多' },
    { prompt: '◆ ◆ ◆ ◆ ◆ 和 ◆ ◆ ◆，哪一邊比較少？', answer: '◆ ◆ ◆', options: '◆ ◆ ◆ ◆ ◆,◆ ◆ ◆,一樣少' },
    { prompt: '哪一個數字最大？6, 1, 8, 3', answer: '8', options: '3,8,6,1' },
    { prompt: '哪一個數字最小？9, 7, 2, 5', answer: '2', options: '7,5,2,9' },
    { prompt: '● ● ● ● ● ● 和 ● ● ● ●，哪一邊比較多？', answer: '左邊', options: '左邊,右邊,一樣多' },
    { prompt: '15 和 9，哪一個比較大？', answer: '15', options: '15,9' },
    { prompt: '20 和 11，哪一個比較小？', answer: '11', options: '20,11' },
    { prompt: '18 和 18，哪一個比較大？', answer: '一樣大', options: '18,一樣大,左邊的18' },
  ]
  for (const q of compareQuestions) {
    await prisma.questionTemplate.create({
      data: {
        skillId: countCompare.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        options: q.options,
        explanation: '仔細比較兩個數或兩組物品的數量，找出較大或較小的那一邊',
      },
    })
  }

  // ───────── 4. 10 以內加法（add-within-10）: 30+ 題 ─────────
  // 參數化模板 × 3（不同範圍）
  const addTemplates = [
    { prompt: '{a} + {b} = ?', params: { aMin: 1, aMax: 5, bMin: 1, bMax: 5, sumMax: 10 }, expl: '把兩個數合起來，一個一個往上數就能得到答案' },
    { prompt: '{a} + {b} = ?', params: { aMin: 1, aMax: 8, bMin: 1, bMax: 3, sumMax: 10 }, expl: '從比較大的數開始，再往後數比較小的數' },
    { prompt: '{a} + {b} = ?', params: { aMin: 2, aMax: 6, bMin: 2, bMax: 5, sumMax: 10 }, expl: '兩個數合在一起，用手指或積木幫忙算一算' },
  ]
  for (const t of addTemplates) {
    await prisma.questionTemplate.create({
      data: {
        skillId: addWithin10.id,
        type: 'ADD',
        prompt: t.prompt,
        paramsJson: JSON.stringify(t.params),
        answer: '{a+b}',
        explanation: t.expl,
      },
    })
  }
  // 直接題 20+ 題
  const addDirect = [
    { prompt: '1 + 1 = ?', answer: '2' },
    { prompt: '1 + 2 = ?', answer: '3' },
    { prompt: '2 + 1 = ?', answer: '3' },
    { prompt: '1 + 3 = ?', answer: '4' },
    { prompt: '3 + 1 = ?', answer: '4' },
    { prompt: '2 + 2 = ?', answer: '4' },
    { prompt: '1 + 4 = ?', answer: '5' },
    { prompt: '4 + 1 = ?', answer: '5' },
    { prompt: '3 + 2 = ?', answer: '5' },
    { prompt: '2 + 3 = ?', answer: '5' },
    { prompt: '2 + 4 = ?', answer: '6' },
    { prompt: '4 + 2 = ?', answer: '6' },
    { prompt: '3 + 3 = ?', answer: '6' },
    { prompt: '5 + 2 = ?', answer: '7' },
    { prompt: '2 + 5 = ?', answer: '7' },
    { prompt: '3 + 4 = ?', answer: '7' },
    { prompt: '4 + 3 = ?', answer: '7' },
    { prompt: '1 + 7 = ?', answer: '8' },
    { prompt: '4 + 4 = ?', answer: '8' },
    { prompt: '5 + 3 = ?', answer: '8' },
    { prompt: '1 + 8 = ?', answer: '9' },
    { prompt: '5 + 4 = ?', answer: '9' },
    { prompt: '6 + 3 = ?', answer: '9' },
    { prompt: '1 + 9 = ?', answer: '10' },
    { prompt: '9 + 1 = ?', answer: '10' },
    { prompt: '2 + 8 = ?', answer: '10' },
    { prompt: '8 + 2 = ?', answer: '10' },
    { prompt: '3 + 7 = ?', answer: '10' },
    { prompt: '7 + 3 = ?', answer: '10' },
  ]
  for (const q of addDirect) {
    await prisma.questionTemplate.create({
      data: {
        skillId: addWithin10.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: `${q.prompt.replace(' = ?', '')} = ${q.answer}，把兩個數合起來`,
      },
    })
  }

  // ───────── 5. 10 以內減法（sub-within-10）: 30+ 題 ─────────
  const subTemplates = [
    { prompt: '{a} - {b} = ?', params: { aMin: 3, aMax: 10, bMin: 1, bMax: 5 }, expl: '從大數裡面拿走小數，數一數剩下多少' },
    { prompt: '{a} - {b} = ?', params: { aMin: 5, aMax: 10, bMin: 1, bMax: 3 }, expl: '用倒數的方法：從大的數往回數小的數' },
    { prompt: '{a} - {b} = ?', params: { aMin: 2, aMax: 8, bMin: 1, bMax: 4 }, expl: '想像把東西拿走，剩下的就是答案' },
  ]
  for (const t of subTemplates) {
    await prisma.questionTemplate.create({
      data: {
        skillId: subWithin10.id,
        type: 'SUB',
        prompt: t.prompt,
        paramsJson: JSON.stringify(t.params),
        answer: '{a-b}',
        explanation: t.expl,
      },
    })
  }
  const subDirect = [
    { prompt: '2 - 1 = ?', answer: '1' },
    { prompt: '3 - 1 = ?', answer: '2' },
    { prompt: '3 - 2 = ?', answer: '1' },
    { prompt: '4 - 1 = ?', answer: '3' },
    { prompt: '4 - 2 = ?', answer: '2' },
    { prompt: '4 - 3 = ?', answer: '1' },
    { prompt: '5 - 1 = ?', answer: '4' },
    { prompt: '5 - 2 = ?', answer: '3' },
    { prompt: '5 - 3 = ?', answer: '2' },
    { prompt: '6 - 2 = ?', answer: '4' },
    { prompt: '6 - 3 = ?', answer: '3' },
    { prompt: '7 - 3 = ?', answer: '4' },
    { prompt: '7 - 4 = ?', answer: '3' },
    { prompt: '8 - 3 = ?', answer: '5' },
    { prompt: '8 - 5 = ?', answer: '3' },
    { prompt: '9 - 4 = ?', answer: '5' },
    { prompt: '9 - 6 = ?', answer: '3' },
    { prompt: '10 - 3 = ?', answer: '7' },
    { prompt: '10 - 4 = ?', answer: '6' },
    { prompt: '10 - 5 = ?', answer: '5' },
    { prompt: '10 - 7 = ?', answer: '3' },
    { prompt: '6 - 6 = ?', answer: '0' },
    { prompt: '8 - 8 = ?', answer: '0' },
    { prompt: '9 - 1 = ?', answer: '8' },
    { prompt: '9 - 8 = ?', answer: '1' },
    { prompt: '10 - 1 = ?', answer: '9' },
    { prompt: '10 - 9 = ?', answer: '1' },
    { prompt: '7 - 5 = ?', answer: '2' },
    { prompt: '7 - 6 = ?', answer: '1' },
    { prompt: '5 - 4 = ?', answer: '1' },
  ]
  for (const q of subDirect) {
    await prisma.questionTemplate.create({
      data: {
        skillId: subWithin10.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: `${q.prompt.replace(' = ?', '')} = ${q.answer}，從大數裡拿走小數`,
      },
    })
  }

  // ───────── 6. 20 以內加法（add-within-20）: 25+ 題 ─────────
  // 參數化模板 × 3
  const add20Templates = [
    { prompt: '{a} + {b} = ?', params: { aMin: 5, aMax: 10, bMin: 5, bMax: 10, sumMax: 20 }, expl: '先湊十再算剩下的，例如把數字拆成 10 和剩下的部分' },
    { prompt: '{a} + {b} = ?', params: { aMin: 8, aMax: 15, bMin: 1, bMax: 5, sumMax: 20 }, expl: '從大數往後數小數，也可以用心算' },
    { prompt: '{a} + {b} = ?', params: { aMin: 3, aMax: 12, bMin: 3, bMax: 12, sumMax: 20 }, expl: '把兩個數合起來，個位數和十位數分開加' },
  ]
  for (const t of add20Templates) {
    await prisma.questionTemplate.create({
      data: {
        skillId: addWithin20.id,
        type: 'ADD',
        prompt: t.prompt,
        paramsJson: JSON.stringify(t.params),
        answer: '{a+b}',
        explanation: t.expl,
      },
    })
  }
  const add20Direct = [
    { prompt: '12 + 5 = ?', answer: '17' },
    { prompt: '8 + 11 = ?', answer: '19' },
    { prompt: '14 + 3 = ?', answer: '17' },
    { prompt: '9 + 7 = ?', answer: '16' },
    { prompt: '15 + 4 = ?', answer: '19' },
    { prompt: '6 + 12 = ?', answer: '18' },
    { prompt: '11 + 6 = ?', answer: '17' },
    { prompt: '7 + 10 = ?', answer: '17' },
    { prompt: '13 + 5 = ?', answer: '18' },
    { prompt: '10 + 8 = ?', answer: '18' },
    { prompt: '5 + 13 = ?', answer: '18' },
    { prompt: '16 + 3 = ?', answer: '19' },
    { prompt: '4 + 15 = ?', answer: '19' },
    { prompt: '11 + 8 = ?', answer: '19' },
    { prompt: '9 + 9 = ?', answer: '18' },
    { prompt: '7 + 11 = ?', answer: '18' },
    { prompt: '13 + 6 = ?', answer: '19' },
    { prompt: '10 + 10 = ?', answer: '20' },
    { prompt: '14 + 5 = ?', answer: '19' },
    { prompt: '8 + 9 = ?', answer: '17' },
    { prompt: '6 + 13 = ?', answer: '19' },
    { prompt: '12 + 7 = ?', answer: '19' },
  ]
  for (const q of add20Direct) {
    await prisma.questionTemplate.create({
      data: {
        skillId: addWithin20.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: `${q.prompt.replace(' = ?', '')} = ${q.answer}，先算個位數再加十位數`,
      },
    })
  }

  // ───────── 7. 簡單文字題（word-problem）: 30+ 題 ─────────
  // WORD_PROBLEM 參數化模板
  const wordTemplates = [
    { prompt: '小明有 {a} 顆糖果，媽媽又給了他 {b} 顆，現在有幾顆？', op: 'add', params: { aMin: 1, aMax: 5, bMin: 1, bMax: 5, sumMax: 10 } },
    { prompt: '樹上有 {a} 隻小鳥，飛走了 {b} 隻，還剩幾隻？', op: 'sub', params: { aMin: 3, aMax: 10, bMin: 1, bMax: 5 } },
    { prompt: '停車場有 {a} 輛車，又開來了 {b} 輛，現在有幾輛？', op: 'add', params: { aMin: 1, aMax: 5, bMin: 1, bMax: 5, sumMax: 10 } },
    { prompt: '書架上有 {a} 本書，弟弟拿走了 {b} 本，還剩幾本？', op: 'sub', params: { aMin: 3, aMax: 10, bMin: 1, bMax: 5 } },
    { prompt: '池塘裡有 {a} 條魚，又游來了 {b} 條，共有幾條？', op: 'add', params: { aMin: 1, aMax: 5, bMin: 1, bMax: 5, sumMax: 10 } },
    { prompt: '媽媽烤了 {a} 塊餅乾，吃了 {b} 塊，還剩幾塊？', op: 'sub', params: { aMin: 3, aMax: 10, bMin: 1, bMax: 5 } },
    { prompt: '籃子裡有 {a} 顆蘋果，又放進 {b} 顆，現在有幾顆？', op: 'add', params: { aMin: 1, aMax: 5, bMin: 1, bMax: 5, sumMax: 10 } },
    { prompt: '有 {a} 顆氣球，風吹走了 {b} 顆，還剩幾顆？', op: 'sub', params: { aMin: 3, aMax: 10, bMin: 1, bMax: 5 } },
    { prompt: '鉛筆盒裡有 {a} 枝鉛筆，又放了 {b} 枝，共有幾枝？', op: 'add', params: { aMin: 1, aMax: 5, bMin: 1, bMax: 5, sumMax: 10 } },
    { prompt: '操場上有 {a} 個小朋友，走了 {b} 個，還剩幾個？', op: 'sub', params: { aMin: 3, aMax: 10, bMin: 1, bMax: 5 } },
    { prompt: '花瓶裡有 {a} 朵花，又插了 {b} 朵，現在有幾朵？', op: 'add', params: { aMin: 1, aMax: 5, bMin: 1, bMax: 5, sumMax: 10 } },
    { prompt: '弟弟有 {a} 張貼紙，送給朋友 {b} 張，還剩幾張？', op: 'sub', params: { aMin: 3, aMax: 10, bMin: 1, bMax: 5 } },
  ]
  for (const t of wordTemplates) {
    const opLabel = t.op === 'add' ? '加法' : '減法'
    await prisma.questionTemplate.create({
      data: {
        skillId: wordProblem.id,
        type: 'WORD_PROBLEM',
        prompt: t.prompt,
        paramsJson: JSON.stringify({ ...t.params, operation: t.op }),
        answer: '{a+b}',
        explanation: `這是${opLabel}問題。把情境中的數量找出來，判斷要用加的還是減的，然後算出答案。`,
      },
    })
  }
  // 直接文字題補充
  const wordDirect = [
    { prompt: '桌上有 3 顆蘋果，又放了 4 顆，現在有幾顆？', answer: '7', expl: '這是加法問題。3 + 4 = 7，所以現在有 7 顆蘋果。' },
    { prompt: '有 10 顆糖果，吃掉 3 顆，還剩幾顆？', answer: '7', expl: '這是減法問題。10 - 3 = 7，所以還剩 7 顆糖果。' },
    { prompt: '鉛筆盒裡有 5 枝筆，再放進 2 枝，共有幾枝？', answer: '7', expl: '這是加法問題。5 + 2 = 7，所以共有 7 枝筆。' },
    { prompt: '有 8 顆氣球，飛走 2 顆，還剩幾顆？', answer: '6', expl: '這是減法問題。8 - 2 = 6，所以還剩 6 顆氣球。' },
    { prompt: '花園裡有 4 朵花，又開了 5 朵，現在有幾朵？', answer: '9', expl: '這是加法問題。4 + 5 = 9，所以現在有 9 朵花。' },
    { prompt: '姊姊有 7 塊餅乾，吃了 2 塊，還剩幾塊？', answer: '5', expl: '這是減法問題。7 - 2 = 5，所以還剩 5 塊餅乾。' },
    { prompt: '魚缸裡有 4 條魚，又買了 3 條，現在有幾條？', answer: '7', expl: '這是加法問題。4 + 3 = 7，所以現在有 7 條魚。' },
    { prompt: '教室裡有 9 個小朋友，出去 4 個，還剩幾個？', answer: '5', expl: '這是減法問題。9 - 4 = 5，所以還剩 5 個小朋友。' },
    { prompt: '冰箱裡有 6 顆雞蛋，又放進 3 顆，共有幾顆？', answer: '9', expl: '這是加法問題。6 + 3 = 9，所以共有 9 顆雞蛋。' },
    { prompt: '書桌上有 8 本書，拿走 5 本，還剩幾本？', answer: '3', expl: '這是減法問題。8 - 5 = 3，所以還剩 3 本書。' },
    { prompt: '盒子裡有 2 顆巧克力，又放了 6 顆，現在有幾顆？', answer: '8', expl: '這是加法問題。2 + 6 = 8，所以現在有 8 顆巧克力。' },
    { prompt: '有 7 顆蘋果，吃了 1 顆，還剩幾顆？', answer: '6', expl: '這是減法問題。7 - 1 = 6，所以還剩 6 顆蘋果。' },
    { prompt: '弟弟有 3 輛玩具車，哥哥給了他 5 輛，現在有幾輛？', answer: '8', expl: '這是加法問題。3 + 5 = 8，所以現在有 8 輛玩具車。' },
    { prompt: '杯子裡有 9 顆彈珠，倒出 6 顆，杯子裡還剩幾顆？', answer: '3', expl: '這是減法問題。9 - 6 = 3，所以還剩 3 顆彈珠。' },
    { prompt: '樹下有 5 隻兔子，又來了 4 隻，現在有幾隻？', answer: '9', expl: '這是加法問題。5 + 4 = 9，所以現在有 9 隻兔子。' },
    { prompt: '媽媽買了 10 個包子，爸爸吃了 2 個，還剩幾個？', answer: '8', expl: '這是減法問題。10 - 2 = 8，所以還剩 8 個包子。' },
    { prompt: '口袋裡有 4 元，又撿到 5 元，現在有幾元？', answer: '9', expl: '這是加法問題。4 + 5 = 9，所以現在有 9 元。' },
    { prompt: '盤子裡有 8 顆水餃，妹妹吃了 3 顆，還剩幾顆？', answer: '5', expl: '這是減法問題。8 - 3 = 5，所以還剩 5 顆水餃。' },
  ]
  for (const q of wordDirect) {
    await prisma.questionTemplate.create({
      data: {
        skillId: wordProblem.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: q.expl,
      },
    })
  }

  // ═══════════════════════════════════════════════
  // G2 乘法與除法題庫
  // ═══════════════════════════════════════════════

  // ───────── 8. 乘法入門（intro-multiply）: 30+ 題 ─────────
  // MUL 參數化模板 × 3
  const introMulTemplates = [
    { prompt: '{a} × {b} = ?', params: { aMin: 2, aMax: 5, bMin: 2, bMax: 5 }, expl: '乘法就是連加！{a} × {b} 就是把 {a} 連加 {b} 次，也可以想成 {b} 個 {a}' },
    { prompt: '{a} × {b} = ?', params: { aMin: 2, aMax: 5, bMin: 2, bMax: 5 }, expl: '用連加來想：{a} + {a} + ... 加 {b} 次，就是答案' },
    { prompt: '{a} × {b} = ?', params: { aMin: 2, aMax: 5, bMin: 2, bMax: 5 }, expl: '背誦九九乘法：先記住 2×2=4, 2×3=6, 2×4=8, 2×5=10 這些基本乘法' },
  ]
  for (const t of introMulTemplates) {
    await prisma.questionTemplate.create({
      data: {
        skillId: introMultiply.id,
        type: 'MUL',
        prompt: t.prompt,
        paramsJson: JSON.stringify(t.params),
        answer: '{a*b}',
        explanation: t.expl,
      },
    })
  }

  // 直接題：連加引入 + 乘法概念
  const introMulDirect: { prompt: string; answer: string; expl: string }[] = [
    // 連加引入
    { prompt: '3 + 3 + 3 + 3 = ?（提示：這也是 4 × 3）', answer: '12', expl: '4 個 3 連加：3 + 3 + 3 + 3 = 12，也就是 4 × 3 = 12' },
    { prompt: '2 + 2 + 2 = ?（提示：這也是 3 × 2）', answer: '6', expl: '3 個 2 連加：2 + 2 + 2 = 6，也就是 3 × 2 = 6' },
    { prompt: '5 + 5 = ?（提示：這也是 2 × 5）', answer: '10', expl: '2 個 5 連加：5 + 5 = 10，也就是 2 × 5 = 10' },
    { prompt: '4 + 4 + 4 + 4 + 4 = ?（提示：這也是 5 × 4）', answer: '20', expl: '5 個 4 連加 = 20，也就是 5 × 4 = 20' },
    { prompt: '3 + 3 + 3 + 3 + 3 = ?（提示：這也是 5 × 3）', answer: '15', expl: '5 個 3 連加 = 15，也就是 5 × 3 = 15' },
    { prompt: '2 + 2 + 2 + 2 = ?（提示：這也是 4 × 2）', answer: '8', expl: '4 個 2 連加 = 8，也就是 4 × 2 = 8' },

    // 乘法轉連加
    { prompt: '5 × 2 = ?（用連加想：5 + 5 = ?）', answer: '10', expl: '5 × 2 = 5 + 5 = 10' },
    { prompt: '3 × 4 = ?（用連加想：3 + 3 + 3 + 3 = ?）', answer: '12', expl: '3 × 4 = 3 + 3 + 3 + 3 = 12' },
    { prompt: '2 × 5 = ?（用連加想：2 + 2 + 2 + 2 + 2 = ?）', answer: '10', expl: '2 × 5 = 2 + 2 + 2 + 2 + 2 = 10' },
    { prompt: '4 × 3 = ?（用連加想：4 + 4 + 4 = ?）', answer: '12', expl: '4 × 3 = 4 + 4 + 4 = 12' },

    // 概念題
    { prompt: '4 個 3 相加是多少？', answer: '12', expl: '4 個 3 相加 = 3 + 3 + 3 + 3 = 12，也就是 4 × 3 = 12' },
    { prompt: '3 個 5 相加是多少？', answer: '15', expl: '3 個 5 相加 = 5 + 5 + 5 = 15，也就是 3 × 5 = 15' },
    { prompt: '5 個 2 相加是多少？', answer: '10', expl: '5 個 2 相加 = 2 + 2 + 2 + 2 + 2 = 10，也就是 5 × 2 = 10' },
    { prompt: '2 個 4 相加是多少？', answer: '8', expl: '2 個 4 相加 = 4 + 4 = 8，也就是 2 × 4 = 8' },

    // 基礎九九乘法（2-5）
    { prompt: '2 × 2 = ?', answer: '4', expl: '2 × 2 = 4，二二得四' },
    { prompt: '2 × 3 = ?', answer: '6', expl: '2 × 3 = 6，二三得六' },
    { prompt: '2 × 4 = ?', answer: '8', expl: '2 × 4 = 8，二四得八' },
    { prompt: '2 × 5 = ?', answer: '10', expl: '2 × 5 = 10，二五得十' },
    { prompt: '3 × 2 = ?', answer: '6', expl: '3 × 2 = 6，三二得六' },
    { prompt: '3 × 3 = ?', answer: '9', expl: '3 × 3 = 9，三三得九' },
    { prompt: '3 × 4 = ?', answer: '12', expl: '3 × 4 = 12，三四十二' },
    { prompt: '3 × 5 = ?', answer: '15', expl: '3 × 5 = 15，三五一十五' },
    { prompt: '4 × 2 = ?', answer: '8', expl: '4 × 2 = 8，四二得八' },
    { prompt: '4 × 3 = ?', answer: '12', expl: '4 × 3 = 12，四三十二' },
    { prompt: '4 × 4 = ?', answer: '16', expl: '4 × 4 = 16，四四十六' },
    { prompt: '4 × 5 = ?', answer: '20', expl: '4 × 5 = 20，四五二十' },
    { prompt: '5 × 2 = ?', answer: '10', expl: '5 × 2 = 10，五二得十' },
    { prompt: '5 × 3 = ?', answer: '15', expl: '5 × 3 = 15，五三十五' },
    { prompt: '5 × 4 = ?', answer: '20', expl: '5 × 4 = 20，五四二十' },
    { prompt: '5 × 5 = ?', answer: '25', expl: '5 × 5 = 25，五五二十五' },
  ]
  for (const q of introMulDirect) {
    await prisma.questionTemplate.create({
      data: {
        skillId: introMultiply.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: q.expl,
      },
    })
  }

  // ───────── 9. 6-9 的乘法（multiply-6-9）: 30+ 題 ─────────
  const mul69Templates = [
    { prompt: '{a} × {b} = ?', params: { aMin: 6, aMax: 9, bMin: 1, bMax: 5 }, expl: '先記住 6-9 乘以 1-5 的口訣，熟練後再挑戰更大的數字' },
    { prompt: '{a} × {b} = ?', params: { aMin: 6, aMax: 9, bMin: 6, bMax: 9 }, expl: '練習 6-9 之間互相相乘，這是九九乘法最難的部分，多練習就會熟練' },
    { prompt: '{a} × {b} = ?', params: { aMin: 6, aMax: 9, bMin: 1, bMax: 9 }, expl: '綜合練習 6-9 的乘法，涵蓋 6×1 到 9×9' },
  ]
  for (const t of mul69Templates) {
    await prisma.questionTemplate.create({
      data: {
        skillId: multiply69.id,
        type: 'MUL',
        prompt: t.prompt,
        paramsJson: JSON.stringify(t.params),
        answer: '{a*b}',
        explanation: t.expl,
      },
    })
  }

  // 6-9 乘法精選直接題（常見易錯題）
  const mul69Direct: { prompt: string; answer: string; expl: string }[] = [
    { prompt: '6 × 7 = ?', answer: '42', expl: '6 × 7 = 42，六七四十二' },
    { prompt: '6 × 8 = ?', answer: '48', expl: '6 × 8 = 48，六八四十八' },
    { prompt: '6 × 9 = ?', answer: '54', expl: '6 × 9 = 54，六九五十四' },
    { prompt: '7 × 6 = ?', answer: '42', expl: '7 × 6 = 42，七六四十二' },
    { prompt: '7 × 7 = ?', answer: '49', expl: '7 × 7 = 49，七七四十九' },
    { prompt: '7 × 8 = ?', answer: '56', expl: '7 × 8 = 56，七八五十六' },
    { prompt: '7 × 9 = ?', answer: '63', expl: '7 × 9 = 63，七九六十三' },
    { prompt: '8 × 6 = ?', answer: '48', expl: '8 × 6 = 48，八六四十八' },
    { prompt: '8 × 7 = ?', answer: '56', expl: '8 × 7 = 56，八七五十六' },
    { prompt: '8 × 8 = ?', answer: '64', expl: '8 × 8 = 64，八八六十四' },
    { prompt: '8 × 9 = ?', answer: '72', expl: '8 × 9 = 72，八九七十二' },
    { prompt: '9 × 6 = ?', answer: '54', expl: '9 × 6 = 54，九六五十四' },
    { prompt: '9 × 7 = ?', answer: '63', expl: '9 × 7 = 63，九七六十三' },
    { prompt: '9 × 8 = ?', answer: '72', expl: '9 × 8 = 72，九八七十二' },
    { prompt: '9 × 9 = ?', answer: '81', expl: '9 × 9 = 81，九九八十一' },
    { prompt: '6 × 3 = ?', answer: '18', expl: '6 × 3 = 18，六三十八' },
    { prompt: '6 × 4 = ?', answer: '24', expl: '6 × 4 = 24，六四二十四' },
    { prompt: '6 × 5 = ?', answer: '30', expl: '6 × 5 = 30，六五三十' },
    { prompt: '7 × 3 = ?', answer: '21', expl: '7 × 3 = 21，七三二十一' },
    { prompt: '7 × 4 = ?', answer: '28', expl: '7 × 4 = 28，七四二十八' },
    { prompt: '7 × 5 = ?', answer: '35', expl: '7 × 5 = 35，七五三十五' },
    { prompt: '8 × 3 = ?', answer: '24', expl: '8 × 3 = 24，八三二十四' },
    { prompt: '8 × 4 = ?', answer: '32', expl: '8 × 4 = 32，八四三十二' },
    { prompt: '8 × 5 = ?', answer: '40', expl: '8 × 5 = 40，八五四十' },
    { prompt: '9 × 2 = ?', answer: '18', expl: '9 × 2 = 18，九二十八' },
    { prompt: '9 × 3 = ?', answer: '27', expl: '9 × 3 = 27，九三二十七' },
    { prompt: '9 × 4 = ?', answer: '36', expl: '9 × 4 = 36，九四三十六' },
    { prompt: '9 × 5 = ?', answer: '45', expl: '9 × 5 = 45，九五四十五' },
  ]
  for (const q of mul69Direct) {
    await prisma.questionTemplate.create({
      data: {
        skillId: multiply69.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: q.expl,
      },
    })
  }

  // ───────── 10. 九九乘法練習（multiply-table）: 40+ 題 ─────────
  const mulTableTemplates = [
    { prompt: '{a} × {b} = ?', params: { aMin: 2, aMax: 9, bMin: 2, bMax: 9 }, expl: '隨機練習全範圍九九乘法，從 2×2 到 9×9' },
    { prompt: '{a} × {b} = ?', params: { aMin: 2, aMax: 9, bMin: 2, bMax: 9 }, expl: '多練習不同的組合，熟練九九乘法口訣' },
    { prompt: '{a} × {b} = ?', params: { aMin: 2, aMax: 9, bMin: 2, bMax: 9 }, expl: '試著在心裡默念口訣，加快計算速度' },
    { prompt: '{a} × {b} = ?', params: { aMin: 2, aMax: 9, bMin: 2, bMax: 9 }, expl: '九九乘法是數學的基礎，熟練後做除法也會變快喔！' },
  ]
  for (const t of mulTableTemplates) {
    await prisma.questionTemplate.create({
      data: {
        skillId: multiplyTable.id,
        type: 'MUL',
        prompt: t.prompt,
        paramsJson: JSON.stringify(t.params),
        answer: '{a*b}',
        explanation: t.expl,
      },
    })
  }

  // ─── 九九乘法補充 20 題 ───
  for (const q of [
    { prompt: '2 × 8 = ?', answer: '16' }, { prompt: '3 × 7 = ?', answer: '21' },
    { prompt: '4 × 9 = ?', answer: '36' }, { prompt: '5 × 6 = ?', answer: '30' },
    { prompt: '6 × 8 = ?', answer: '48' }, { prompt: '7 × 7 = ?', answer: '49' },
    { prompt: '8 × 9 = ?', answer: '72' }, { prompt: '9 × 6 = ?', answer: '54' },
    { prompt: '3 × 8 = ?', answer: '24' }, { prompt: '4 × 7 = ?', answer: '28' },
    { prompt: '5 × 9 = ?', answer: '45' }, { prompt: '6 × 7 = ?', answer: '42' },
    { prompt: '7 × 8 = ?', answer: '56' }, { prompt: '8 × 6 = ?', answer: '48' },
    { prompt: '9 × 9 = ?', answer: '81' }, { prompt: '2 × 6 = ?', answer: '12' },
    { prompt: '6 × 6 = ?', answer: '36' }, { prompt: '7 × 9 = ?', answer: '63' },
    { prompt: '4 × 8 = ?', answer: '32' }, { prompt: '5 × 7 = ?', answer: '35' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: multiplyTable.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: `${q.prompt.replace(' = ?', '')} = ${q.answer}，用九九乘法口訣來算` },
    })
  }

  // ───────── 11. 除法入門（intro-divide）: 25+ 題 ─────────
  // DIV 參數化模板 × 3
  const introDivTemplates = [
    { prompt: '{a} ÷ {b} = ?', params: { aMin: 4, aMax: 30, bMin: 2, bMax: 5, aMultipleOfB: true }, expl: '除法就是平分！{a} 個東西平分給 {b} 個人，每人得到幾個？' },
    { prompt: '{a} ÷ {b} = ?', params: { aMin: 4, aMax: 30, bMin: 2, bMax: 5, aMultipleOfB: true }, expl: '想一想：{b} × ? = {a}，這個 ? 就是答案' },
    { prompt: '{a} ÷ {b} = ?', params: { aMin: 6, aMax: 40, bMin: 2, bMax: 5, aMultipleOfB: true }, expl: '用乘法來幫忙：先想想 {b} 的九九乘法，找到乘起來等於 {a} 的數字' },
  ]
  for (const t of introDivTemplates) {
    await prisma.questionTemplate.create({
      data: {
        skillId: introDivide.id,
        type: 'DIV',
        prompt: t.prompt,
        paramsJson: JSON.stringify(t.params),
        answer: '{a/b}',
        explanation: t.expl,
      },
    })
  }

  // 除法直接題：平分概念
  const introDivDirect: { prompt: string; answer: string; expl: string }[] = [
    // 平分文字題
    { prompt: '把 12 顆糖果平分給 3 個人，每人得到幾顆？', answer: '4', expl: '12 ÷ 3 = 4，每人得到 4 顆糖果。想一想：3 × 4 = 12' },
    { prompt: '把 10 顆蘋果平分給 2 個人，每人得到幾顆？', answer: '5', expl: '10 ÷ 2 = 5，每人得到 5 顆蘋果。想一想：2 × 5 = 10' },
    { prompt: '把 15 張貼紙平分給 5 個小朋友，每人得到幾張？', answer: '3', expl: '15 ÷ 5 = 3，每人得到 3 張貼紙。想一想：5 × 3 = 15' },
    { prompt: '把 8 塊餅乾平分給 4 個人，每人得到幾塊？', answer: '2', expl: '8 ÷ 4 = 2，每人得到 2 塊餅乾。想一想：4 × 2 = 8' },
    { prompt: '把 20 顆彈珠平分給 4 個盒子，每個盒子有幾顆？', answer: '5', expl: '20 ÷ 4 = 5，每個盒子有 5 顆。想一想：4 × 5 = 20' },
    { prompt: '把 18 朵花平分給 3 個花瓶，每個花瓶有幾朵？', answer: '6', expl: '18 ÷ 3 = 6，每個花瓶有 6 朵。想一想：3 × 6 = 18' },
    { prompt: '把 14 本書平分給 2 個書架，每個書架有幾本？', answer: '7', expl: '14 ÷ 2 = 7，每個書架有 7 本。想一想：2 × 7 = 14' },
    { prompt: '把 24 顆巧克力平分給 4 個人，每人得到幾顆？', answer: '6', expl: '24 ÷ 4 = 6，每人得到 6 顆。想一想：4 × 6 = 24' },
    { prompt: '把 16 枝鉛筆平分給 4 個鉛筆盒，每個鉛筆盒有幾枝？', answer: '4', expl: '16 ÷ 4 = 4，每個鉛筆盒有 4 枝。想一想：4 × 4 = 16' },
    { prompt: '把 9 顆草莓平分給 3 個人，每人得到幾顆？', answer: '3', expl: '9 ÷ 3 = 3，每人得到 3 顆。想一想：3 × 3 = 9' },

    // 用乘法想除法
    { prompt: '10 ÷ 2 = ?（想：2 × ? = 10）', answer: '5', expl: '2 × 5 = 10，所以 10 ÷ 2 = 5' },
    { prompt: '12 ÷ 4 = ?（想：4 × ? = 12）', answer: '3', expl: '4 × 3 = 12，所以 12 ÷ 4 = 3' },
    { prompt: '15 ÷ 3 = ?（想：3 × ? = 15）', answer: '5', expl: '3 × 5 = 15，所以 15 ÷ 3 = 5' },
    { prompt: '20 ÷ 5 = ?（想：5 × ? = 20）', answer: '4', expl: '5 × 4 = 20，所以 20 ÷ 5 = 4' },
    { prompt: '6 ÷ 2 = ?（想：2 × ? = 6）', answer: '3', expl: '2 × 3 = 6，所以 6 ÷ 2 = 3' },
    { prompt: '8 ÷ 2 = ?（想：2 × ? = 8）', answer: '4', expl: '2 × 4 = 8，所以 8 ÷ 2 = 4' },
    { prompt: '25 ÷ 5 = ?（想：5 × ? = 25）', answer: '5', expl: '5 × 5 = 25，所以 25 ÷ 5 = 5' },
    { prompt: '30 ÷ 5 = ?（想：5 × ? = 30）', answer: '6', expl: '5 × 6 = 30，所以 30 ÷ 5 = 6' },
  ]
  for (const q of introDivDirect) {
    await prisma.questionTemplate.create({
      data: {
        skillId: introDivide.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: q.expl,
      },
    })
  }

  // ───────── 12. 基礎除法（divide-basic）: 25+ 題 ─────────
  const divBasicTemplates = [
    { prompt: '{a} ÷ {b} = ?', params: { aMin: 10, aMax: 50, bMin: 2, bMax: 9, aMultipleOfB: true }, expl: '熟練較大數字的除法，記得檢查：除數 × 商 = 被除數' },
    { prompt: '{a} ÷ {b} = ?', params: { aMin: 6, aMax: 45, bMin: 2, bMax: 9, aMultipleOfB: true }, expl: '除法是乘法的逆運算，用乘法口訣來幫忙' },
  ]
  for (const t of divBasicTemplates) {
    await prisma.questionTemplate.create({
      data: {
        skillId: divideBasic.id,
        type: 'DIV',
        prompt: t.prompt,
        paramsJson: JSON.stringify(t.params),
        answer: '{a/b}',
        explanation: t.expl,
      },
    })
  }

  // 基礎除法直接題
  const divBasicDirect: { prompt: string; answer: string; expl: string }[] = [
    { prompt: '21 ÷ 3 = ?', answer: '7', expl: '3 × 7 = 21，所以 21 ÷ 3 = 7' },
    { prompt: '24 ÷ 6 = ?', answer: '4', expl: '6 × 4 = 24，所以 24 ÷ 6 = 4' },
    { prompt: '28 ÷ 7 = ?', answer: '4', expl: '7 × 4 = 28，所以 28 ÷ 7 = 4' },
    { prompt: '32 ÷ 8 = ?', answer: '4', expl: '8 × 4 = 32，所以 32 ÷ 8 = 4' },
    { prompt: '36 ÷ 9 = ?', answer: '4', expl: '9 × 4 = 36，所以 36 ÷ 9 = 4' },
    { prompt: '27 ÷ 3 = ?', answer: '9', expl: '3 × 9 = 27，所以 27 ÷ 3 = 9' },
    { prompt: '35 ÷ 5 = ?', answer: '7', expl: '5 × 7 = 35，所以 35 ÷ 5 = 7' },
    { prompt: '42 ÷ 6 = ?', answer: '7', expl: '6 × 7 = 42，所以 42 ÷ 6 = 7' },
    { prompt: '48 ÷ 8 = ?', answer: '6', expl: '8 × 6 = 48，所以 48 ÷ 8 = 6' },
    { prompt: '54 ÷ 9 = ?', answer: '6', expl: '9 × 6 = 54，所以 54 ÷ 9 = 6' },
    { prompt: '18 ÷ 6 = ?', answer: '3', expl: '6 × 3 = 18，所以 18 ÷ 6 = 3' },
    { prompt: '40 ÷ 5 = ?', answer: '8', expl: '5 × 8 = 40，所以 40 ÷ 5 = 8' },
    { prompt: '45 ÷ 9 = ?', answer: '5', expl: '9 × 5 = 45，所以 45 ÷ 9 = 5' },
    { prompt: '49 ÷ 7 = ?', answer: '7', expl: '7 × 7 = 49，所以 49 ÷ 7 = 7' },
    { prompt: '56 ÷ 8 = ?', answer: '7', expl: '8 × 7 = 56，所以 56 ÷ 8 = 7' },
    { prompt: '63 ÷ 7 = ?', answer: '9', expl: '7 × 9 = 63，所以 63 ÷ 7 = 9' },
    { prompt: '64 ÷ 8 = ?', answer: '8', expl: '8 × 8 = 64，所以 64 ÷ 8 = 8' },
    { prompt: '72 ÷ 9 = ?', answer: '8', expl: '9 × 8 = 72，所以 72 ÷ 9 = 8' },
    { prompt: '81 ÷ 9 = ?', answer: '9', expl: '9 × 9 = 81，所以 81 ÷ 9 = 9' },
    { prompt: '36 ÷ 4 = ?', answer: '9', expl: '4 × 9 = 36，所以 36 ÷ 4 = 9' },
    { prompt: '30 ÷ 6 = ?', answer: '5', expl: '6 × 5 = 30，所以 30 ÷ 6 = 5' },
    { prompt: '28 ÷ 4 = ?', answer: '7', expl: '4 × 7 = 28，所以 28 ÷ 4 = 7' },
    { prompt: '22 ÷ 2 = ?', answer: '11', expl: '2 × 11 = 22，所以 22 ÷ 2 = 11' },
  ]
  for (const q of divBasicDirect) {
    await prisma.questionTemplate.create({
      data: {
        skillId: divideBasic.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: q.expl,
      },
    })
  }

  // ═══════════════════════════════════════════════
  // G2 文字題擴充（含乘法與除法情境）
  // ═══════════════════════════════════════════════

  // WORD_PROBLEM 乘法情境模板
  const wordMulTemplates = [
    { prompt: '教室裡有 {a} 排桌子，每排有 {b} 張，共有幾張桌子？', op: 'mul', params: { aMin: 2, aMax: 5, bMin: 3, bMax: 6 } },
    { prompt: '一週有 7 天，{a} 週共有幾天？', op: 'mul', params: { aMin: 2, aMax: 4, bMin: 7, bMax: 7 } },
    { prompt: '一個盒子裝 {a} 顆糖果，{b} 盒共有幾顆？', op: 'mul', params: { aMin: 3, aMax: 6, bMin: 2, bMax: 5 } },
    { prompt: '一包有 {a} 張貼紙，買了 {b} 包，共有幾張？', op: 'mul', params: { aMin: 3, aMax: 5, bMin: 2, bMax: 5 } },
    { prompt: '每組有 {a} 個小朋友，{b} 組共有幾個小朋友？', op: 'mul', params: { aMin: 2, aMax: 5, bMin: 3, bMax: 6 } },
  ]
  for (const t of wordMulTemplates) {
    await prisma.questionTemplate.create({
      data: {
        skillId: wordProblem.id,
        type: 'WORD_PROBLEM',
        prompt: t.prompt,
        paramsJson: JSON.stringify({ ...t.params, operation: t.op }),
        answer: '{a*b}',
        explanation: '這是乘法問題。把每一份的數量乘以份數，就能得到總數。',
      },
    })
  }

  // WORD_PROBLEM 除法情境模板
  const wordDivTemplates = [
    { prompt: '{a} 顆球平分給 {b} 個班級，每班有幾顆？', op: 'div', params: { aMin: 8, aMax: 30, bMin: 2, bMax: 5 } },
    { prompt: '{a} 顆蘋果，每 {b} 顆裝一袋，可以裝成幾袋？', op: 'div', params: { aMin: 6, aMax: 30, bMin: 2, bMax: 5 } },
    { prompt: '把 {a} 元平分給 {b} 個人，每人得到幾元？', op: 'div', params: { aMin: 8, aMax: 30, bMin: 2, bMax: 5 } },
    { prompt: '{a} 本書放在 {b} 個書架上，每個書架放幾本？', op: 'div', params: { aMin: 8, aMax: 30, bMin: 2, bMax: 5 } },
    { prompt: '{a} 個小朋友，每 {b} 人一組，可以分成幾組？', op: 'div', params: { aMin: 6, aMax: 30, bMin: 2, bMax: 5 } },
  ]
  for (const t of wordDivTemplates) {
    await prisma.questionTemplate.create({
      data: {
        skillId: wordProblem.id,
        type: 'WORD_PROBLEM',
        prompt: t.prompt,
        paramsJson: JSON.stringify({ ...t.params, operation: t.op }),
        answer: '{a/b}',
        explanation: '這是除法問題。把總數平分（或分裝），看看能分成幾份或每份有多少。',
      },
    })
  }

  // 直接乘法文字題
  const wordMulDirect: { prompt: string; answer: string; expl: string }[] = [
    { prompt: '教室裡有 4 排桌子，每排有 5 張，共有幾張桌子？', answer: '20', expl: '4 × 5 = 20，共有 20 張桌子' },
    { prompt: '一週有 7 天，3 週共有幾天？', answer: '21', expl: '7 × 3 = 21，3 週共有 21 天' },
    { prompt: '一個盒子裝 6 個雞蛋，4 盒共有幾個雞蛋？', answer: '24', expl: '6 × 4 = 24，4 盒共有 24 個雞蛋' },
    { prompt: '一包有 4 枝鉛筆，買 5 包共有幾枝？', answer: '20', expl: '4 × 5 = 20，5 包共有 20 枝鉛筆' },
    { prompt: '每籃有 3 顆蘋果，6 籃共有幾顆？', answer: '18', expl: '3 × 6 = 18，6 籃共有 18 顆蘋果' },
    { prompt: '一天有 24 小時，2 天共有幾小時？', answer: '48', expl: '24 × 2 = 48，2 天共有 48 小時' },
    { prompt: '每排有 8 個座位，3 排共有幾個座位？', answer: '24', expl: '8 × 3 = 24，3 排共有 24 個座位' },
    { prompt: '一個人有 2 隻手，9 個人共有幾隻手？', answer: '18', expl: '2 × 9 = 18，9 個人共有 18 隻手' },
    { prompt: '每束花有 5 朵，4 束共有幾朵？', answer: '20', expl: '5 × 4 = 20，4 束共有 20 朵花' },
    { prompt: '一輛車有 4 個輪子，6 輛車共有幾個輪子？', answer: '24', expl: '4 × 6 = 24，6 輛車共有 24 個輪子' },
  ]
  for (const q of wordMulDirect) {
    await prisma.questionTemplate.create({
      data: {
        skillId: wordProblem.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: q.expl,
      },
    })
  }

  // 直接除法文字題
  const wordDivDirect: { prompt: string; answer: string; expl: string }[] = [
    { prompt: '20 顆球平分給 4 個班級，每班有幾顆？', answer: '5', expl: '20 ÷ 4 = 5，每班有 5 顆球' },
    { prompt: '15 顆蘋果，每 3 顆裝一袋，可以裝成幾袋？', answer: '5', expl: '15 ÷ 3 = 5，可以裝成 5 袋' },
    { prompt: '24 元平分給 6 個人，每人得到幾元？', answer: '4', expl: '24 ÷ 6 = 4，每人得到 4 元' },
    { prompt: '18 本書放在 3 個書架上，每個書架放幾本？', answer: '6', expl: '18 ÷ 3 = 6，每個書架放 6 本' },
    { prompt: '12 個小朋友，每 4 人一組，可以分成幾組？', answer: '3', expl: '12 ÷ 4 = 3，可以分成 3 組' },
    { prompt: '30 顆糖果平分給 5 個小朋友，每人幾顆？', answer: '6', expl: '30 ÷ 5 = 6，每人 6 顆' },
    { prompt: '28 張貼紙，每 7 張貼一本，可以貼幾本？', answer: '4', expl: '28 ÷ 7 = 4，可以貼 4 本' },
    { prompt: '36 個學生，每 9 人排一隊，可以排幾隊？', answer: '4', expl: '36 ÷ 9 = 4，可以排 4 隊' },
    { prompt: '16 塊蛋糕平分給 8 個人，每人幾塊？', answer: '2', expl: '16 ÷ 8 = 2，每人 2 塊' },
    { prompt: '45 顆彈珠，每 5 顆裝一盒，可以裝幾盒？', answer: '9', expl: '45 ÷ 5 = 9，可以裝 9 盒' },
  ]
  for (const q of wordDivDirect) {
    await prisma.questionTemplate.create({
      data: {
        skillId: wordProblem.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: q.expl,
      },
    })
  }

  // ───────── 互動模式題目（來自 main 分支）─────────
  // 數字線題目（數數技能）
  await prisma.questionTemplate.create({
    data: {
      skillId: countObjects.id,
      type: 'DIRECT',
      prompt: '🍎 🍎 🍎 🍎 🍎  樹上共有幾顆蘋果？請在數字線上點選答案。',
      answer: '5',
      paramsJson: JSON.stringify({ interaction: 'numberline', rangeMin: 1, rangeMax: 10 }),
      explanation: '數一數 🍎 的數量，1、2、3、4、5，共 5 顆蘋果。',
    },
  })
  await prisma.questionTemplate.create({
    data: {
      skillId: countObjects.id,
      type: 'DIRECT',
      prompt: '🐟 🐟 🐟 🐟 🐟 🐟 🐟 🐟  池塘裡有幾條魚？請在數字線上點選答案。',
      answer: '8',
      paramsJson: JSON.stringify({ interaction: 'numberline', rangeMin: 1, rangeMax: 10 }),
      explanation: '數一數 🐟 的數量，1、2、3、4、5、6、7、8，共 8 條魚。',
    },
  })
  await prisma.questionTemplate.create({
    data: {
      skillId: countObjects.id,
      type: 'DIRECT',
      prompt: '📖 📖 📖  桌上有幾本書？請在數字線上點選答案。',
      answer: '3',
      paramsJson: JSON.stringify({ interaction: 'numberline', rangeMin: 1, rangeMax: 10 }),
      explanation: '3 在數字線靠左邊的位置，介於 1 和 5 之間。',
    },
  })

  // 數字線題目（數量比較技能）
  await prisma.questionTemplate.create({
    data: {
      skillId: countCompare.id,
      type: 'DIRECT',
      prompt: '7 和 10，哪個數字比較大？請在數字線上點選較大的數。',
      answer: '10',
      paramsJson: JSON.stringify({ interaction: 'numberline', rangeMin: 1, rangeMax: 10 }),
      explanation: '在數字線上，越往右邊的數字越大。10 在 7 的右邊，所以 10 比較大。',
    },
  })
  await prisma.questionTemplate.create({
    data: {
      skillId: countCompare.id,
      type: 'DIRECT',
      prompt: '4 和 2，哪個數字比較小？請在數字線上點選較小的數。',
      answer: '2',
      paramsJson: JSON.stringify({ interaction: 'numberline', rangeMin: 1, rangeMax: 10 }),
      explanation: '在數字線上，越往左邊的數字越小。2 在 4 的左邊，所以 2 比較小。',
    },
  })

  // 更多視覺數字線題目
  await prisma.questionTemplate.create({
    data: {
      skillId: countObjects.id,
      type: 'DIRECT',
      prompt: '⭐ ⭐ ⭐ ⭐ ⭐ ⭐ ⭐  天上有幾顆星星？請在數字線上點選答案。',
      answer: '7',
      paramsJson: JSON.stringify({ interaction: 'numberline', rangeMin: 1, rangeMax: 10 }),
      explanation: '數一數 ⭐ 的數量，總共有 7 顆星星。',
    },
  })
  await prisma.questionTemplate.create({
    data: {
      skillId: countObjects.id,
      type: 'DIRECT',
      prompt: '🌸 🌸 🌸 🌸  花園裡有幾朵花？請在數字線上點選答案。',
      answer: '4',
      paramsJson: JSON.stringify({ interaction: 'numberline', rangeMin: 1, rangeMax: 10 }),
      explanation: '數一數 🌸 的數量，總共有 4 朵花。',
    },
  })
  await prisma.questionTemplate.create({
    data: {
      skillId: countCompare.id,
      type: 'DIRECT',
      prompt: '🍎🍎🍎🍎🍎  vs  🍊🍊🍊  蘋果和橘子，哪一種比較多？請在數字線上點選數量多的那個數字。',
      answer: '5',
      paramsJson: JSON.stringify({ interaction: 'numberline', rangeMin: 1, rangeMax: 10 }),
      explanation: '蘋果有 5 顆，橘子有 3 顆，5 > 3，所以蘋果比較多。',
    },
  })

  // 填答鍵盤題目（加減法技能）
  await prisma.questionTemplate.create({
    data: {
      skillId: addWithin10.id,
      type: 'DIRECT',
      prompt: '5 + 3 = ? （請用鍵盤輸入答案）',
      answer: '8',
      paramsJson: JSON.stringify({ interaction: 'fillin' }),
      explanation: '5 加 3 等於 8，把兩個數合起來。',
    },
  })
  await prisma.questionTemplate.create({
    data: {
      skillId: addWithin10.id,
      type: 'DIRECT',
      prompt: '2 + 6 = ? （請用鍵盤輸入答案）',
      answer: '8',
      paramsJson: JSON.stringify({ interaction: 'fillin' }),
      explanation: '2 加 6 等於 8。',
    },
  })
  await prisma.questionTemplate.create({
    data: {
      skillId: addWithin10.id,
      type: 'DIRECT',
      prompt: '4 + 4 = ? （請用鍵盤輸入答案）',
      answer: '8',
      paramsJson: JSON.stringify({ interaction: 'fillin' }),
      explanation: '4 加 4 等於 8。',
    },
  })
  await prisma.questionTemplate.create({
    data: {
      skillId: subWithin10.id,
      type: 'DIRECT',
      prompt: '7 - 3 = ? （請用鍵盤輸入答案）',
      answer: '4',
      paramsJson: JSON.stringify({ interaction: 'fillin' }),
      explanation: '7 減 3 等於 4，從 7 裡面拿走 3 個。',
    },
  })
  await prisma.questionTemplate.create({
    data: {
      skillId: subWithin10.id,
      type: 'DIRECT',
      prompt: '9 - 5 = ? （請用鍵盤輸入答案）',
      answer: '4',
      paramsJson: JSON.stringify({ interaction: 'fillin' }),
      explanation: '9 減 5 等於 4。',
    },
  })

  // ============ 成就徽章 ============
  const badges = [
    { code: 'first-practice', name: '第一次練習', icon: '🌟', condition: '完成首次練習' },
    { code: 'streak-7', name: '練習一週', icon: '🔥', condition: '連續 7 天練習' },
    { code: 'streak-14', name: '練習兩週', icon: '💪', condition: '連續 14 天練習' },
    { code: 'streak-30', name: '練習一個月', icon: '🏆', condition: '連續 30 天練習' },
    { code: 'stars-50', name: '收集 50 星', icon: '⭐', condition: '累計 50 顆星星' },
    { code: 'stars-100', name: '收集 100 星', icon: '⭐⭐', condition: '累計 100 顆星星' },
    { code: 'perfect-score', name: '完美得分', icon: '🎯', condition: '一次練習全對' },
    { code: 'all-skills', name: '全能學習者', icon: '📚', condition: '所有技能都練過至少一次' },
    { code: 'addition-master', name: '加法達人', icon: '🧮', condition: '加法技能正確率 ≥ 90%（最近 20 題）' },
    { code: 'promotion-pass', name: '升學挑戰成功', icon: '🎓', condition: '第一次升學測試通過' },
    { code: 'promotion-star', name: '學業明星', icon: '⭐', condition: '通過 3 次升學測試' },

    // ============ 新增難度梯度成就（橫跨累計 / 連擊 / 速度 / 達人 / 精進）============
    // 🟢 簡單
    { code: 'persistent-5', name: '練習小將', icon: '📅', condition: '累計完成 5 次練習' },
    { code: 'combo-10', name: '十連擊', icon: '✨', condition: '連續答對 10 題（不計家長協助）' },
    // 🟡 中等
    { code: 'speed-demon', name: '閃電小能手', icon: '⚡', condition: '連續 5 題在 5 秒內答對' },
    { code: 'subtraction-master', name: '減法達人', icon: '➖', condition: '減法技能正確率 ≥ 90%（最近 20 題）' },
    // 🔴 困難
    { code: 'mastery-3', name: '精通三藝', icon: '🧠', condition: '3 個技能達到掌握（95%）' },
    { code: 'combo-25', name: '答題高手', icon: '💎', condition: '連續答對 25 題（不計家長協助）' },

    // ============ 提升練習成就 ============
    { code: 'challenge-first', name: '初試鋒芒', icon: '⚡', condition: '第一次完成提升練習' },
    { code: 'challenge-all-correct', name: '挑戰大師', icon: '🏅', condition: '提升練習全部答對' },
  ]

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { code: badge.code },
      update: { name: badge.name, icon: badge.icon, condition: badge.condition },
      create: badge,
    })
  }

  // ═══════════════════════════════════════════════
  // 加大現有題庫：為 K-2 技能補充更多題目
  // ═══════════════════════════════════════════════

  // ─── 數數 補充 12 題 ───
  for (const q of [
    { prompt: '★ ★ ★ ★ ★ ★ ★ ★ ★ 有幾個★？', answer: '9', options: '8,9,10' },
    { prompt: '● ● ● ● ● ● ● 有幾個●？', answer: '7', options: '6,7,8' },
    { prompt: '■ ■ ■ ■ ■ ■ 有幾個■？', answer: '6', options: '5,6,7' },
    { prompt: '◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ 有幾個◆？', answer: '8', options: '7,8,9' },
    { prompt: '♥ ♥ ♥ ♥ ♥ 有幾個♥？', answer: '5', options: '4,5,6' },
    { prompt: '⭐ ⭐ ⭐ ⭐ ⭐ ⭐ 有幾個⭐？', answer: '6', options: '5,6,7' },
    { prompt: '💎 💎 💎 有幾個💎？', answer: '3', options: '2,3,4' },
    { prompt: '🌺 🌺 🌺 🌺 🌺 🌺 🌺 🌺 🌺 有幾個🌺？', answer: '9', options: '8,9,10' },
    { prompt: '🍎 🍎 🍎 🍎 🍎 🍎 🍎 🍎 有幾個🍎？', answer: '8', options: '7,8,9' },
    { prompt: '🐟 🐟 🐟 🐟 🐟 🐟 有幾條🐟？', answer: '6', options: '5,6,7' },
    { prompt: '🐱 🐱 🐱 🐱 🐱 🐱 🐱 有幾隻🐱？', answer: '7', options: '6,7,8' },
    { prompt: '🌸 🌸 🌸 🌸 有幾朵🌸？', answer: '4', options: '3,4,5' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: countObjects.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, options: q.options, explanation: `一個一個數，總共有 ${q.answer} 個` },
    })
  }

  // ─── 10 以內加法 補充 15 題 ───
  for (const q of [
    { prompt: '2 + 6 = ?', answer: '8' }, { prompt: '6 + 2 = ?', answer: '8' },
    { prompt: '3 + 5 = ?', answer: '8' }, { prompt: '5 + 3 = ?', answer: '8' },
    { prompt: '4 + 6 = ?', answer: '10' }, { prompt: '6 + 4 = ?', answer: '10' },
    { prompt: '7 + 2 = ?', answer: '9' }, { prompt: '2 + 7 = ?', answer: '9' },
    { prompt: '8 + 1 = ?', answer: '9' }, { prompt: '1 + 6 = ?', answer: '7' },
    { prompt: '7 + 1 = ?', answer: '8' }, { prompt: '3 + 6 = ?', answer: '9' },
    { prompt: '6 + 1 = ?', answer: '7' }, { prompt: '4 + 5 = ?', answer: '9' },
    { prompt: '5 + 5 = ?', answer: '10' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: addWithin10.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: `${q.prompt.replace(' = ?', '')} = ${q.answer}，把兩個數合起來` },
    })
  }

  // ─── 10 以內減法 補充 15 題 ───
  for (const q of [
    { prompt: '8 - 2 = ?', answer: '6' }, { prompt: '8 - 6 = ?', answer: '2' },
    { prompt: '7 - 1 = ?', answer: '6' }, { prompt: '9 - 3 = ?', answer: '6' },
    { prompt: '9 - 7 = ?', answer: '2' }, { prompt: '10 - 6 = ?', answer: '4' },
    { prompt: '10 - 8 = ?', answer: '2' }, { prompt: '6 - 2 = ?', answer: '4' },
    { prompt: '6 - 5 = ?', answer: '1' }, { prompt: '5 - 3 = ?', answer: '2' },
    { prompt: '8 - 4 = ?', answer: '4' }, { prompt: '8 - 7 = ?', answer: '1' },
    { prompt: '9 - 2 = ?', answer: '7' }, { prompt: '9 - 5 = ?', answer: '4' },
    { prompt: '7 - 2 = ?', answer: '5' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: subWithin10.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: `${q.prompt.replace(' = ?', '')} = ${q.answer}，從大數裡拿走小數` },
    })
  }

  // ─── 20 以內加法 補充 15 題 ───
  for (const q of [
    { prompt: '14 + 4 = ?', answer: '18' }, { prompt: '11 + 9 = ?', answer: '20' },
    { prompt: '8 + 12 = ?', answer: '20' }, { prompt: '15 + 5 = ?', answer: '20' },
    { prompt: '12 + 6 = ?', answer: '18' }, { prompt: '7 + 13 = ?', answer: '20' },
    { prompt: '9 + 11 = ?', answer: '20' }, { prompt: '16 + 4 = ?', answer: '20' },
    { prompt: '13 + 7 = ?', answer: '20' }, { prompt: '10 + 9 = ?', answer: '19' },
    { prompt: '5 + 14 = ?', answer: '19' }, { prompt: '17 + 2 = ?', answer: '19' },
    { prompt: '3 + 16 = ?', answer: '19' }, { prompt: '12 + 8 = ?', answer: '20' },
    { prompt: '6 + 14 = ?', answer: '20' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: addWithin20.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: `${q.prompt.replace(' = ?', '')} = ${q.answer}，先算個位數再加十位數` },
    })
  }

  // ═══════════════════════════════════════════════
  // G3 ~ G6 題庫
  // ═══════════════════════════════════════════════

  // ─── G3: 百以內加減 ───
  for (const t of [
    { prompt: '{a} + {b} = ?', params: { aMin: 20, aMax: 50, bMin: 10, bMax: 40, sumMax: 100 } },
    { prompt: '{a} - {b} = ?', params: { aMin: 30, aMax: 80, bMin: 10, bMax: 40 } },
    { prompt: '{a} + {b} = ?', params: { aMin: 45, aMax: 70, bMin: 5, bMax: 25, sumMax: 100 } },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: addSub100.id, type: t.prompt.includes('+') ? 'ADD' as const : 'SUB' as const, prompt: t.prompt, paramsJson: JSON.stringify(t.params), answer: t.prompt.includes('+') ? '{a+b}' : '{a-b}', explanation: '先算個位數，再算十位數，注意進位與借位。' },
    })
  }
  for (const q of [
    { prompt: '56 + 23 = ?', answer: '79' }, { prompt: '87 - 35 = ?', answer: '52' },
    { prompt: '44 + 38 = ?', answer: '82' }, { prompt: '73 - 46 = ?', answer: '27' },
    { prompt: '62 + 29 = ?', answer: '91' }, { prompt: '95 - 58 = ?', answer: '37' },
    { prompt: '38 + 47 = ?', answer: '85' }, { prompt: '81 - 63 = ?', answer: '18' },
    { prompt: '55 + 36 = ?', answer: '91' }, { prompt: '70 - 44 = ?', answer: '26' },
    { prompt: '29 + 58 = ?', answer: '87' }, { prompt: '64 - 28 = ?', answer: '36' },
    { prompt: '46 + 37 = ?', answer: '83' }, { prompt: '92 - 37 = ?', answer: '55' },
    { prompt: '18 + 75 = ?', answer: '93' }, { prompt: '53 - 29 = ?', answer: '24' },
    { prompt: '35 + 48 = ?', answer: '83' }, { prompt: '86 - 47 = ?', answer: '39' },
    { prompt: '67 + 26 = ?', answer: '93' }, { prompt: '100 - 45 = ?', answer: '55' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: addSub100.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: `${q.prompt.replace(' = ?', '')} = ${q.answer}` },
    })
  }

  // ─── G3: 乘法進階 ───
  for (const t of [
    { prompt: '{a} × {b} = ?', params: { aMin: 3, aMax: 9, bMin: 11, bMax: 20 } },
    { prompt: '{a} × {b} = ?', params: { aMin: 2, aMax: 8, bMin: 12, bMax: 25 } },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: multiplyAdvanced.id, type: 'MUL', prompt: t.prompt, paramsJson: JSON.stringify(t.params), answer: '{a*b}', explanation: '將兩位數拆成十位和個位分別計算' },
    })
  }
  for (const q of [
    { prompt: '4 × 12 = ?', answer: '48' }, { prompt: '6 × 13 = ?', answer: '78' },
    { prompt: '7 × 14 = ?', answer: '98' }, { prompt: '3 × 15 = ?', answer: '45' },
    { prompt: '5 × 16 = ?', answer: '80' }, { prompt: '8 × 12 = ?', answer: '96' },
    { prompt: '9 × 11 = ?', answer: '99' }, { prompt: '4 × 18 = ?', answer: '72' },
    { prompt: '6 × 15 = ?', answer: '90' }, { prompt: '5 × 19 = ?', answer: '95' },
    { prompt: '7 × 12 = ?', answer: '84' }, { prompt: '3 × 24 = ?', answer: '72' },
    { prompt: '8 × 11 = ?', answer: '88' }, { prompt: '4 × 22 = ?', answer: '88' },
    { prompt: '6 × 14 = ?', answer: '84' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: multiplyAdvanced.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: `${q.prompt.replace(' = ?', '')} = ${q.answer}` },
    })
  }

  // ─── G3: 除法進階 ───
  for (const t of [
    { prompt: '{a} ÷ {b} = ?', params: { aMin: 20, aMax: 60, bMin: 3, bMax: 9, aMultipleOfB: true } },
    { prompt: '{a} ÷ {b} = ?', params: { aMin: 30, aMax: 80, bMin: 2, bMax: 7, aMultipleOfB: true } },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: divideAdvanced.id, type: 'DIV', prompt: t.prompt, paramsJson: JSON.stringify(t.params), answer: '{a/b}', explanation: '利用乘法口訣來算除法' },
    })
  }
  for (const q of [
    { prompt: '36 ÷ 4 = ?', answer: '9' }, { prompt: '54 ÷ 6 = ?', answer: '9' },
    { prompt: '48 ÷ 8 = ?', answer: '6' }, { prompt: '63 ÷ 7 = ?', answer: '9' },
    { prompt: '72 ÷ 9 = ?', answer: '8' }, { prompt: '56 ÷ 7 = ?', answer: '8' },
    { prompt: '45 ÷ 5 = ?', answer: '9' }, { prompt: '32 ÷ 4 = ?', answer: '8' },
    { prompt: '42 ÷ 6 = ?', answer: '7' }, { prompt: '60 ÷ 5 = ?', answer: '12' },
    { prompt: '96 ÷ 8 = ?', answer: '12' }, { prompt: '84 ÷ 7 = ?', answer: '12' },
    { prompt: '28 ÷ 4 = ?', answer: '7' }, { prompt: '66 ÷ 6 = ?', answer: '11' },
    { prompt: '78 ÷ 6 = ?', answer: '13' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: divideAdvanced.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: `${q.prompt.replace(' = ?', '')} = ${q.answer}` },
    })
  }

  // ─── G3: 四則混合 ───
  for (const q of [
    { prompt: '3 + 5 × 2 = ?', answer: '13', expl: '先乘後加：5×2=10，3+10=13' },
    { prompt: '10 - 6 ÷ 2 = ?', answer: '7', expl: '先除後減：6÷2=3，10-3=7' },
    { prompt: '4 × 3 + 5 = ?', answer: '17', expl: '4×3=12，12+5=17' },
    { prompt: '20 ÷ 4 - 3 = ?', answer: '2', expl: '20÷4=5，5-3=2' },
    { prompt: '6 + 4 × 2 = ?', answer: '14' }, { prompt: '15 - 3 × 2 = ?', answer: '9' },
    { prompt: '12 ÷ 3 + 1 = ?', answer: '5' }, { prompt: '8 + 8 ÷ 2 = ?', answer: '12' },
    { prompt: '7 × 2 - 5 = ?', answer: '9' }, { prompt: '18 ÷ 3 + 4 = ?', answer: '10' },
    { prompt: '(3 + 5) × 2 = ?', answer: '16', expl: '括號先算：8×2=16' },
    { prompt: '(10 - 2) ÷ 4 = ?', answer: '2' }, { prompt: '(4 + 6) × 3 = ?', answer: '30' },
    { prompt: '(20 - 5) ÷ 5 = ?', answer: '3' }, { prompt: '2 × (3 + 4) = ?', answer: '14' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: mixedOps.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: q.expl ?? '先乘除後加減，有括號先算括號內' },
    })
  }

  // ─── G3: 分數初步 ───
  for (const q of [
    { prompt: '把蛋糕平分成 4 份，1 份是幾分之幾？', answer: '1/4' },
    { prompt: '把圓平分成 8 份，3 份是幾分之幾？', answer: '3/8' },
    { prompt: '1/2 和 1/3 哪個大？', answer: '1/2' },
    { prompt: '1/4 + 2/4 = ?', answer: '3/4' },
    { prompt: '3/5 - 1/5 = ?', answer: '2/5' },
    { prompt: '2/3 和 3/4 哪個大？', answer: '3/4' },
    { prompt: '5/8 + 2/8 = ?', answer: '7/8' },
    { prompt: '7/9 - 4/9 = ?', answer: '3/9' },
    { prompt: '1 又 1/2 = ?', answer: '3/2' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: fractionIntro.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: '認識分數的基本概念與同分母分數加減' },
    })
  }

  // ─── G3: 三位數加減 ───
  for (const q of [
    { prompt: '356 + 231 = ?', answer: '587' }, { prompt: '789 - 345 = ?', answer: '444' },
    { prompt: '405 + 328 = ?', answer: '733' }, { prompt: '672 - 489 = ?', answer: '183' },
    { prompt: '518 + 293 = ?', answer: '811' }, { prompt: '951 - 637 = ?', answer: '314' },
    { prompt: '264 + 577 = ?', answer: '841' }, { prompt: '823 - 456 = ?', answer: '367' },
    { prompt: '609 + 294 = ?', answer: '903' }, { prompt: '745 - 368 = ?', answer: '377' },
    { prompt: '437 + 386 = ?', answer: '823' }, { prompt: '514 - 279 = ?', answer: '235' },
    { prompt: '398 + 475 = ?', answer: '873' }, { prompt: '620 - 431 = ?', answer: '189' },
    { prompt: '546 + 389 = ?', answer: '935' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: threeDigitAddSub.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: `${q.prompt.replace(' = ?', '')} = ${q.answer}，注意進位與借位` },
    })
  }

  // ─── G3: 分數基礎 ───
  for (const q of [
    { prompt: '把圓平分成 6 份，1 份是幾分之幾？', answer: '1/6' },
    { prompt: '把長方形平分成 5 份，2 份是幾分之幾？', answer: '2/5' },
    { prompt: '1/4 > 1/6 對嗎？', answer: '對' },
    { prompt: '1/3 < 1/2 對嗎？', answer: '對' },
    { prompt: '4/6 約分 = ?', answer: '2/3' },
    { prompt: '2/4 約分 = ?', answer: '1/2' },
    { prompt: '3/9 約分 = ?', answer: '1/3' },
    { prompt: '1/2 = ?/4', answer: '2' },
    { prompt: '1/3 = ?/6', answer: '2' },
    { prompt: '在數線上，0 到 1 分成 4 格，第 3 格是幾分之幾？', answer: '3/4' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: introFraction.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: '分數的分子與分母、約分與等值分數' },
    })
  }

  // ─── G3: 時間計算 ───
  for (const q of [
    { prompt: '1 小時 = ? 分鐘', answer: '60' },
    { prompt: '2 小時 = ? 分鐘', answer: '120' },
    { prompt: '1 分鐘 = ? 秒', answer: '60' },
    { prompt: '3 分鐘 = ? 秒', answer: '180' },
    { prompt: '1 天 = ? 小時', answer: '24' },
    { prompt: '半小時 = ? 分鐘', answer: '30' },
    { prompt: '從 3:00 到 4:30 經過了 ? 分鐘', answer: '90' },
    { prompt: '從 9:15 到 10:00 經過了 ? 分鐘', answer: '45' },
    { prompt: '從 7:30 到 8:15 經過了 ? 分鐘', answer: '45' },
    { prompt: '從 10:00 到 12:30 經過了 ? 分鐘', answer: '150' },
    { prompt: '1 小時 30 分 = ? 分鐘', answer: '90' },
    { prompt: '2 小時 15 分 = ? 分鐘', answer: '135' },
    { prompt: '90 分鐘 = ? 小時 ? 分鐘', answer: '1小時30分' },
    { prompt: '75 分鐘 = ? 小時 ? 分鐘', answer: '1小時15分' },
    { prompt: '從 11:45 到 12:15 經過了 ? 分鐘', answer: '30' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: timeCalc.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: '時間單位換算：1 小時 = 60 分，1 分 = 60 秒；算經過時間可用減法' },
    })
  }

  // ─── G3: 面積與周長 ───
  for (const q of [
    { prompt: '正方形邊長 3cm，周長？', answer: '12' },
    { prompt: '長方形長 5cm 寬 3cm，周長？', answer: '16' },
    { prompt: '正方形邊長 6cm，面積？', answer: '36' },
    { prompt: '長方形長 7cm 寬 4cm，面積？', answer: '28' },
    { prompt: '正方形邊長 10cm，周長？', answer: '40' },
    { prompt: '長方形長 8cm 寬 2cm，周長？', answer: '20' },
    { prompt: '正方形邊長 4cm，面積？', answer: '16' },
    { prompt: '長方形長 9cm 寬 5cm，面積？', answer: '45' },
    { prompt: '正方形周長 20cm，邊長？', answer: '5' },
    { prompt: '長方形長 6cm 寬 4cm，周長和面積分各是多少？', answer: '20和24' },
    { prompt: '正方形邊長 2cm，周長是面積的幾倍？', answer: '2' },
    { prompt: '長方形長 12cm 寬 6cm，面積是周長的幾倍？', answer: '2' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: areaPerimeter.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: '正方形周長=4×邊長，面積=邊長²；長方形周長=2×(長+寬)，面積=長×寬' },
    })
  }

  // ─── G4: 分數比較與加減 ───
  for (const q of [
    { prompt: '2/5 + 1/5 = ?', answer: '3/5' }, { prompt: '5/8 - 3/8 = ?', answer: '2/8' },
    { prompt: '1/2 + 1/4 = ?', answer: '3/4' }, { prompt: '3/4 - 1/2 = ?', answer: '1/4' },
    { prompt: '1/3 + 1/6 = ?', answer: '1/2' }, { prompt: '約分 6/8 = ?', answer: '3/4' },
    { prompt: '4/10 化簡 = ?', answer: '2/5' }, { prompt: '5/6 - 1/3 = ?', answer: '1/2' },
    { prompt: '2/3 + 1/6 = ?', answer: '5/6' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: fractionCompare.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: '同分母分數加減、通分與約分練習' },
    })
  }

  // ─── G4: 小數初步 ───
  for (const q of [
    { prompt: '0.5 = ？分數', answer: '1/2' }, { prompt: '0.25 = ？分數', answer: '1/4' },
    { prompt: '0.3 > 0.25 對嗎？', answer: '對' }, { prompt: '0.7 + 0.2 = ?', answer: '0.9' },
    { prompt: '0.8 - 0.3 = ?', answer: '0.5' }, { prompt: '1.5 = ？', answer: '1又1/2' },
    { prompt: '0.6 + 0.4 = ?', answer: '1.0' }, { prompt: '0.9 - 0.6 = ?', answer: '0.3' },
    { prompt: '0.1 × 10 = ?', answer: '1' }, { prompt: '3.2 > 2.8 對嗎？', answer: '對' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: decimalIntro.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: '認識小數與小數的加減運算' },
    })
  }

  // ─── G4: 面積 ───
  for (const q of [
    { prompt: '正方形邊長 5cm，面積？', answer: '25' }, { prompt: '長方形 6×4cm，面積？', answer: '24' },
    { prompt: '正方形邊長 8cm，面積？', answer: '64' }, { prompt: '長方形 9×3cm，面積？', answer: '27' },
    { prompt: '長方形 12×5cm，面積？', answer: '60' }, { prompt: '正方形邊長 7cm，面積？', answer: '49' },
    { prompt: '長方形 10×6cm，面積？', answer: '60' }, { prompt: '正方形邊長 2cm，面積？', answer: '4' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: areaIntro.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: '正方形面積=邊長×邊長，長方形面積=長×寬' },
    })
  }

  // ─── G4: 直式除法 ───
  for (const q of [
    { prompt: '240 ÷ 6 = ?', answer: '40' }, { prompt: '368 ÷ 4 = ?', answer: '92' },
    { prompt: '525 ÷ 5 = ?', answer: '105' }, { prompt: '100 ÷ 4 = ?', answer: '25' },
    { prompt: '180 ÷ 6 = ?', answer: '30' }, { prompt: '720 ÷ 8 = ?', answer: '90' },
    { prompt: '300 ÷ 5 = ?', answer: '60' }, { prompt: '567 ÷ 7 = ?', answer: '81' },
    { prompt: '144 ÷ 6 = ?', answer: '24' }, { prompt: '810 ÷ 9 = ?', answer: '90' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: longDivision.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: `用直式除法計算：${q.prompt.replace(' = ?', '')} = ${q.answer}` },
    })
  }

  // ─── G4: 大數乘法 ───
  for (const t of [
    { prompt: '{a} × {b} = ?', params: { aMin: 12, aMax: 45, bMin: 3, bMax: 9 } },
    { prompt: '{a} × {b} = ?', params: { aMin: 20, aMax: 60, bMin: 4, bMax: 8 } },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: largeMultiply.id, type: 'MUL', prompt: t.prompt, paramsJson: JSON.stringify(t.params), answer: '{a*b}', explanation: '一位數乘兩位數，先乘十位再乘個位' },
    })
  }
  for (const q of [
    { prompt: '23 × 4 = ?', answer: '92' }, { prompt: '35 × 6 = ?', answer: '210' },
    { prompt: '42 × 7 = ?', answer: '294' }, { prompt: '18 × 8 = ?', answer: '144' },
    { prompt: '56 × 5 = ?', answer: '280' }, { prompt: '67 × 3 = ?', answer: '201' },
    { prompt: '29 × 4 = ?', answer: '116' }, { prompt: '73 × 6 = ?', answer: '438' },
    { prompt: '44 × 7 = ?', answer: '308' }, { prompt: '81 × 5 = ?', answer: '405' },
    { prompt: '38 × 9 = ?', answer: '342' }, { prompt: '52 × 8 = ?', answer: '416' },
    { prompt: '15 × 12 = ?', answer: '180' }, { prompt: '24 × 11 = ?', answer: '264' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: largeMultiply.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: `${q.prompt.replace(' = ?', '')} = ${q.answer}` },
    })
  }

  // ─── G4: 大數認識 ───
  for (const q of [
    { prompt: '10 個十是？', answer: '100' },
    { prompt: '10 個百是？', answer: '1000' },
    { prompt: '2386 的「3」在什麼位？', answer: '百位' },
    { prompt: '5104 的「1」在什麼位？', answer: '百位' },
    { prompt: '7000 + 300 + 50 + 2 = ?', answer: '7352' },
    { prompt: '8462 = 8000 + ? + 60 + 2', answer: '400' },
    { prompt: '3520 < 5300 對嗎？', answer: '對' },
    { prompt: '9999 + 1 = ?', answer: '10000' },
    { prompt: '6000 + 4000 = ?', answer: '10000' },
    { prompt: '最大的四位數是？', answer: '9999' },
    { prompt: '最小的四位數是？', answer: '1000' },
    { prompt: '7890 ≈ ?（四捨五入到千位）', answer: '8000' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: largeNumbers.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: '認識萬以內的數與位值' },
    })
  }

  // ─── G4: 三位數×兩位數 ───
  for (const q of [
    { prompt: '123 × 12 = ?', answer: '1476' },
    { prompt: '234 × 15 = ?', answer: '3510' },
    { prompt: '345 × 11 = ?', answer: '3795' },
    { prompt: '456 × 13 = ?', answer: '5928' },
    { prompt: '127 × 14 = ?', answer: '1778' },
    { prompt: '218 × 16 = ?', answer: '3488' },
    { prompt: '305 × 12 = ?', answer: '3660' },
    { prompt: '412 × 21 = ?', answer: '8652' },
    { prompt: '136 × 17 = ?', answer: '2312' },
    { prompt: '250 × 18 = ?', answer: '4500' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: threeByTwoMul.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: `直式計算：${q.prompt.replace(' = ?', '')} = ${q.answer}` },
    })
  }

  // ─── G4: 兩位數除法 ───
  for (const q of [
    { prompt: '100 ÷ 25 = ?', answer: '4' },
    { prompt: '144 ÷ 12 = ?', answer: '12' },
    { prompt: '180 ÷ 15 = ?', answer: '12' },
    { prompt: '200 ÷ 20 = ?', answer: '10' },
    { prompt: '120 ÷ 12 = ?', answer: '10' },
    { prompt: '168 ÷ 14 = ?', answer: '12' },
    { prompt: '150 ÷ 25 = ?', answer: '6' },
    { prompt: '132 ÷ 11 = ?', answer: '12' },
    { prompt: '216 ÷ 18 = ?', answer: '12' },
    { prompt: '260 ÷ 13 = ?', answer: '20' },
    { prompt: '300 ÷ 15 = ?', answer: '20' },
    { prompt: '252 ÷ 14 = ?', answer: '18' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: twoDigitDiv.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: `除數是兩位數，先看被除數的前兩位：${q.prompt.replace(' = ?', '')} = ${q.answer}` },
    })
  }

  // ─── G4: 運算規律 ───
  for (const q of [
    { prompt: '7 + 5 = 5 + ?', answer: '7', expl: '加法交換律' },
    { prompt: '(2 + 3) + 4 = 2 + (3 + ?)', answer: '4', expl: '加法結合律' },
    { prompt: '3 × (5 + 2) = 3 × 5 + 3 × ?', answer: '2', expl: '乘法分配律' },
    { prompt: '8 × (10 + 3) = 8 × 10 + 8 × ?', answer: '3' },
    { prompt: '6 + 8 + 4 = (6 + 4) + 8 = ?', answer: '18' },
    { prompt: '12 + 7 + 8 = (12 + 8) + 7 = ?', answer: '27' },
    { prompt: '25 × 4 = 100， 25 × 8 = ?', answer: '200' },
    { prompt: '4 × 13 × 25 = (4 × 25) × 13 = ?', answer: '1300' },
    { prompt: '99 × 7 + 99 = 99 × (7 + 1) = ?', answer: '792' },
    { prompt: '125 + 99 = 125 + 100 - 1 = ?', answer: '224' },
    { prompt: '350 - 199 = 350 - 200 + 1 = ?', answer: '151' },
    { prompt: '一個數減去 0 等於？', answer: '它本身' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: arithmeticLaws.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: q.expl ?? '利用運算規律可以讓計算更簡便' },
    })
  }

  // ─── G4: 小數性質 ───
  for (const q of [
    { prompt: '0.3 的位名是？', answer: '十分位' },
    { prompt: '0.45 的「4」在什麼位？', answer: '十分位' },
    { prompt: '0.78 的「8」在什麼位？', answer: '百分位' },
    { prompt: '0.3 = 0.30 對嗎？', answer: '對' },
    { prompt: '0.5 和 0.50 哪個大？', answer: '一樣大' },
    { prompt: '把 3.2 寫成小數：三又十分之二', answer: '3.2' },
    { prompt: '0.6 > 0.58 對嗎？', answer: '對' },
    { prompt: '0.07 < 0.1 對嗎？', answer: '對' },
    { prompt: '0.4 + 0.05 = ?', answer: '0.45' },
    { prompt: '將 0.8 寫成分數', answer: '4/5' },
    { prompt: '將 0.25 寫成百分數', answer: '25%' },
    { prompt: '2.35 = 2 + 0.3 + ?', answer: '0.05' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: decimalProperty.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: '小數的位值、位名、大小比較與分數轉換' },
    })
  }

  // ─── G4: 三角形 ───
  for (const q of [
    { prompt: '三角形有幾個角？', answer: '3' },
    { prompt: '三角形三個角的和是多少度？', answer: '180' },
    { prompt: '兩邊一樣長的三角形叫？', answer: '等腰三角形' },
    { prompt: '三邊一樣長的三角形叫？', answer: '正三角形' },
    { prompt: '有一個角是直角三角形的叫？', answer: '直角三角形' },
    { prompt: '等腰三角形的底角會怎麼樣？', answer: '相等' },
    { prompt: '三角形中，最大角是 90 度，這是什麼三角形？', answer: '直角三角形' },
    { prompt: '正三角形的每個角 = ? 度', answer: '60' },
    { prompt: '三角形兩邊長 5cm 和 7cm，第三邊最大約？', answer: '11' },
    { prompt: '三角形有幾條邊？', answer: '3' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: triangle.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: '三角形分類、內角和 180°、兩邊和大於第三邊' },
    })
  }

  // ═══════════════════════════════════════════════
  // G5 題庫
  // ═══════════════════════════════════════════════
  for (const q of [
    { prompt: '1.5 + 2.3 = ?', answer: '3.8' }, { prompt: '4.7 - 1.2 = ?', answer: '3.5' },
    { prompt: '3.6 + 2.8 = ?', answer: '6.4' }, { prompt: '5.4 - 2.9 = ?', answer: '2.5' },
    { prompt: '12.5 + 7.3 = ?', answer: '19.8' }, { prompt: '8.6 - 3.7 = ?', answer: '4.9' },
    { prompt: '0.75 + 0.25 = ?', answer: '1.0' }, { prompt: '6.3 - 4.8 = ?', answer: '1.5' },
    { prompt: '7.2 + 1.9 = ?', answer: '9.1' }, { prompt: '10.0 - 3.6 = ?', answer: '6.4' },
    { prompt: '2.45 + 3.55 = ?', answer: '6.0' }, { prompt: '9.1 - 5.6 = ?', answer: '3.5' },
    { prompt: '4.8 + 5.2 = ?', answer: '10.0' }, { prompt: '15.6 - 7.8 = ?', answer: '7.8' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: decimalOps.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: `對齊小數點計算：${q.prompt.replace(' = ?', '')} = ${q.answer}` },
    })
  }
  for (const q of [
    { prompt: '1/3 + 1/4 = ?', answer: '7/12' }, { prompt: '2/5 + 1/3 = ?', answer: '11/15' },
    { prompt: '3/4 - 1/3 = ?', answer: '5/12' }, { prompt: '1/2 + 1/5 = ?', answer: '7/10' },
    { prompt: '5/6 - 1/2 = ?', answer: '1/3' }, { prompt: '2/3 + 1/5 = ?', answer: '13/15' },
    { prompt: '7/8 - 1/4 = ?', answer: '5/8' }, { prompt: '3/10 + 1/2 = ?', answer: '4/5' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: fractionOps.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: '異分母分數加減：先通分再計算' },
    })
  }
  for (const q of [
    { prompt: '0.3 × 4 = ?', answer: '1.2' }, { prompt: '2.5 × 3 = ?', answer: '7.5' },
    { prompt: '1.2 × 5 = ?', answer: '6.0' }, { prompt: '4.8 ÷ 2 = ?', answer: '2.4' },
    { prompt: '6.3 ÷ 3 = ?', answer: '2.1' }, { prompt: '0.5 × 6 = ?', answer: '3.0' },
    { prompt: '1.5 × 4 = ?', answer: '6.0' }, { prompt: '7.2 ÷ 8 = ?', answer: '0.9' },
    { prompt: '3.6 ÷ 4 = ?', answer: '0.9' }, { prompt: '0.8 × 7 = ?', answer: '5.6' },
    { prompt: '2.4 × 2 = ?', answer: '4.8' }, { prompt: '5.5 ÷ 5 = ?', answer: '1.1' },
    { prompt: '0.6 × 9 = ?', answer: '5.4' }, { prompt: '9.9 ÷ 3 = ?', answer: '3.3' },
    { prompt: '1.8 × 5 = ?', answer: '9.0' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: decimalMulDiv.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: `小數乘除法：${q.prompt.replace(' = ?', '')} = ${q.answer}` },
    })
  }
  for (const q of [
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
    { prompt: '分數的倒數：2/3 的倒數是？', answer: '3/2' },
    { prompt: '分數的倒數：5 的倒數是？', answer: '1/5' },
    { prompt: '分數的倒數：1 的倒數是？', answer: '1' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: fractionMulDiv.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: '分數乘法：分子×分子、分母×分母；除法：乘以倒數' },
    })
  }
  for (const q of [
    { prompt: '長方體 5×3×2cm，體積？', answer: '30' }, { prompt: '正方體邊長 4cm，體積？', answer: '64' },
    { prompt: '長方體 6×2×3cm，體積？', answer: '36' }, { prompt: '正方體邊長 2cm，體積？', answer: '8' },
    { prompt: '長方體 10×4×3cm，體積？', answer: '120' }, { prompt: '正方體邊長 6cm，表面積？', answer: '216' },
    { prompt: '長方體容器 8×5cm，高？ 水 200cm³', answer: '5' },
    { prompt: '正方體邊長 3cm，體積？', answer: '27' },
    { prompt: '長方體 4×4×6cm，體積？', answer: '96' },
    { prompt: '正方體邊長 5cm，表面積？', answer: '150' },
    { prompt: '長方體 7×3×4cm，體積？', answer: '84' },
    { prompt: '正方體邊長 10cm，體積？', answer: '1000' },
    { prompt: '一個長方體長 8cm、寬 5cm、高 3cm，容積？', answer: '120' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: volumeIntro.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: '體積=長×寬×高，表面積=6×邊長²' },
    })
  }

  // ─── G5: 方程（equation）───
  for (const q of [
    { prompt: 'x + 5 = 12，x = ?', answer: '7', expl: '12 - 5 = 7，所以 x = 7' },
    { prompt: 'x - 3 = 8，x = ?', answer: '11', expl: '8 + 3 = 11，所以 x = 11' },
    { prompt: '2x = 10，x = ?', answer: '5', expl: '10 ÷ 2 = 5，所以 x = 5' },
    { prompt: 'x ÷ 4 = 3，x = ?', answer: '12', expl: '3 × 4 = 12，所以 x = 12' },
    { prompt: 'x + 7 = 15，x = ?', answer: '8', expl: '15 - 7 = 8，所以 x = 8' },
    { prompt: 'x - 6 = 5，x = ?', answer: '11', expl: '5 + 6 = 11，所以 x = 11' },
    { prompt: '3x = 18，x = ?', answer: '6', expl: '18 ÷ 3 = 6，所以 x = 6' },
    { prompt: 'x ÷ 5 = 4，x = ?', answer: '20', expl: '4 × 5 = 20，所以 x = 20' },
    { prompt: 'x + 9 = 20，x = ?', answer: '11', expl: '20 - 9 = 11' },
    { prompt: 'x - 12 = 8，x = ?', answer: '20', expl: '8 + 12 = 20' },
    { prompt: '4x = 24，x = ?', answer: '6', expl: '24 ÷ 4 = 6' },
    { prompt: 'x ÷ 6 = 5，x = ?', answer: '30', expl: '5 × 6 = 30' },
    { prompt: '2x + 3 = 11，x = ?', answer: '4', expl: '先減 3：11-3=8，再除以 2：8÷2=4' },
    { prompt: '3x - 4 = 14，x = ?', answer: '6', expl: '先加 4：14+4=18，再除以 3：18÷3=6' },
    { prompt: '5x + 5 = 30，x = ?', answer: '5', expl: '先減 5：30-5=25，再除以 5：25÷5=5' },
    { prompt: '2x - 1 = 9，x = ?', answer: '5', expl: '先加 1：9+1=10，再除以 2：10÷2=5' },
    { prompt: 'x + x = 14，x = ?', answer: '7', expl: '兩個 x 加起來是 14，所以 x = 7' },
    { prompt: '3x - x = 12，x = ?', answer: '6', expl: '3x - x = 2x = 12，x = 6' },
    { prompt: '小華有 x 元，買了 25 元的書後剩下 30 元，小華原有 ? 元', answer: '55', expl: 'x - 25 = 30，x = 55' },
    { prompt: '一個數乘以 4 等於 36，這個數是？', answer: '9', expl: '4x = 36，x = 9' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: equation.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: q.expl ?? '用加減乘除的逆運算來解未知數' },
    })
  }

  // ─── G5: 多邊形的公式計算（polygon-formula）───
  for (const q of [
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
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: polygonFormula.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: q.expl ?? '平行四邊形面積=底×高；三角形面積=底×高÷2；梯形面積=(上底+下底)×高÷2' },
    })
  }

  // ─── G5: 因數與倍數（factors-multiples）───
  for (const q of [
    { prompt: '12 的因數有哪些？（由小到大填寫，逗號分隔）', answer: '1,2,3,4,6,12', expl: '12 = 1×12 = 2×6 = 3×4' },
    { prompt: '8 的倍數列出 3 個（由小到大填寫，逗號分隔）', answer: '8,16,24', expl: '8×1=8, 8×2=16, 8×3=24' },
    { prompt: '6 和 8 的最大公因數（GCF）是？', answer: '2', expl: '6的因數：1,2,3,6；8的因數：1,2,4,8；共同最大的是 2' },
    { prompt: '4 和 6 的最小公倍數（LCM）是？', answer: '12', expl: '4的倍數：4,8,12,16...；6的倍數：6,12,18...；共同最小的是 12' },
    { prompt: '15 的因數有哪些？（逗號分隔）', answer: '1,3,5,15' },
    { prompt: '9 和 12 的最大公因數？', answer: '3' },
    { prompt: '6 和 9 的最小公倍數？', answer: '18' },
    { prompt: '24 的因數有哪些？（逗號分隔）', answer: '1,2,3,4,6,8,12,24' },
    { prompt: '10 和 15 的最大公因數？', answer: '5' },
    { prompt: '8 和 10 的最小公倍數？', answer: '40' },
    { prompt: '質數：只有 1 和自己本身兩個因數。以下是質數的有？1, 2, 3, 4, 5, 6', answer: '2,3,5', expl: '2只能被1和2整除；3只能被1和3整除；5只能被1和5整除' },
    { prompt: '合數：有 3 個（含）以上的因數。以下是合數的有？2, 4, 6, 7, 9', answer: '4,6,9' },
    { prompt: '16 和 24 的最大公因數？', answer: '8' },
    { prompt: '12 和 18 的最小公倍數？', answer: '36' },
    { prompt: '7 是質數還是合數？', answer: '質數' },
    { prompt: '36 的因數有哪些？（逗號分隔）', answer: '1,2,3,4,6,9,12,18,36' },
    { prompt: '20 和 30 的最大公因數？', answer: '10' },
    { prompt: '9 和 15 的最小公倍數？', answer: '45' },
    { prompt: '下列哪個是質數？8, 11, 15, 21', answer: '11' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: factorsMultiples.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: q.expl ?? '因數：能整除該數的整數；倍數：該數乘以整數的結果' },
    })
  }

  // ═══════════════════════════════════════════════
  // G6 題庫
  // ═══════════════════════════════════════════════
  for (const q of [
    { prompt: '化簡比 6:8 = ?', answer: '3:4' }, { prompt: '化簡比 10:15 = ?', answer: '2:3' },
    { prompt: 'a:b=2:5, a=6, b=?', answer: '15' }, { prompt: '12:18 化簡 = ?', answer: '2:3' },
    { prompt: '3:7 = 9:?', answer: '21' }, { prompt: '4:5 = ?:25', answer: '20' },
    { prompt: '化簡 24:36 = ?', answer: '2:3' }, { prompt: '化簡 15:25 = ?', answer: '3:5' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: ratio.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: '比的前項與後項同乘/除相同數字，比值不變' },
    })
  }
  for (const q of [
    { prompt: '0.5 = ?%', answer: '50%' }, { prompt: '1/4 = ?%', answer: '25%' },
    { prompt: '3/4 = ?%', answer: '75%' }, { prompt: '200 元打 8 折 = ?', answer: '160' },
    { prompt: '40 人×60%女生 = ?人', answer: '24' }, { prompt: '0.75 = ?%', answer: '75%' },
    { prompt: '1/10 = ?%', answer: '10%' }, { prompt: '500 元打 7 折 = ?', answer: '350' },
    { prompt: '10000×2%利息 = ?', answer: '200' }, { prompt: '2/5 = ?%', answer: '40%' },
    { prompt: '1/8 = ?%', answer: '12.5%' }, { prompt: '300→240 元是幾折？', answer: '8折' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: percent.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: '百分比 = 分數/小數 × 100%' },
    })
  }
  for (const q of [
    { prompt: '半徑 7cm 直徑？', answer: '14' }, { prompt: '直徑 10cm 半徑？', answer: '5' },
    { prompt: '半徑 5cm 周長？(π=3.14)', answer: '31.4' }, { prompt: '半徑 3cm 面積？(π=3.14)', answer: '28.26' },
    { prompt: '直徑 8cm 周長？(π=3.14)', answer: '25.12' }, { prompt: '半徑 4cm 面積？(π=3.14)', answer: '50.24' },
    { prompt: '半徑 6cm 周長？(π=3.14)', answer: '37.68' }, { prompt: '半徑 2cm 面積？(π=3.14)', answer: '12.56' },
    { prompt: '直徑 14cm 半徑？', answer: '7' }, { prompt: '半徑 10cm 周長？(π=3.14)', answer: '62.8' },
    { prompt: '圓的定義：到定點等距離的點所形成的圖形，定點稱為？', answer: '圓心' },
    { prompt: '連接圓心和圓上任意一點的線段叫？', answer: '半徑' },
    { prompt: '通過圓心且兩端在圓上的線段叫？', answer: '直徑' },
    { prompt: '直徑是半徑的幾倍？', answer: '2' },
    { prompt: '圓周率 π 大約等於？', answer: '3.14' },
    { prompt: '圓周率是圓的什麼除以直徑？', answer: '圓周長' },
    { prompt: '半徑 8cm 直徑？', answer: '16' },
    { prompt: '直徑 20cm 半徑？', answer: '10' },
    { prompt: '半徑 9cm 周長？(π=3.14)', answer: '56.52' },
    { prompt: '直徑 12cm 周長？(π=3.14)', answer: '37.68' },
    { prompt: '半徑 1cm 面積？(π=3.14)', answer: '3.14' },
    { prompt: '直徑 6cm 面積？(π=3.14)', answer: '28.26' },
    { prompt: '半徑 0.5cm 周長？(π=3.14)', answer: '3.14' },
    { prompt: '圓面積公式是？', answer: 'πr²' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: circle.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: '圓的定義：到圓心等距的點集合；圓周長=2πr=πd，圓面積=πr²' },
    })
  }
  for (const q of [
    { prompt: '3h 走 180km 速率？', answer: '60' }, { prompt: '12km/h×2h 距離？', answer: '24' },
    { prompt: '200km÷50km/h 時間？', answer: '4' }, { prompt: '80km/h×4h 距離？', answer: '320' },
    { prompt: '150km÷75km/h 時間？', answer: '2' }, { prompt: '5km/h×1.5h 距離？', answer: '7.5' },
    { prompt: '300km÷5h 速率？', answer: '60' }, { prompt: '60km/h×3.5h 距離？', answer: '210' },
    { prompt: '30min 跑 6km 速率？', answer: '12' }, { prompt: '420km÷70km/h 時間？', answer: '6' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: speed.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: '速率=距離÷時間，距離=速率×時間，時間=距離÷速率' },
    })
  }
  for (const q of [
    { prompt: '圓柱半徑 3cm 高 5cm 體積？(π=3.14)', answer: '141.3' },
    { prompt: '三角柱底 20cm² 高 8cm 體積？', answer: '160' },
    { prompt: '圓柱半徑 4cm 高 6cm 體積？(π=3.14)', answer: '301.44' },
    { prompt: '圓柱半徑 2cm 高 10cm 體積？(π=3.14)', answer: '125.6' },
    { prompt: '柱體底 15cm² 高 12cm 體積？', answer: '180' },
    { prompt: '圓柱半徑 5cm 高 4cm 體積？(π=3.14)', answer: '314' },
    { prompt: '圓柱半徑 1cm 高 7cm 體積？(π=3.14)', answer: '21.98' },
    { prompt: '三角柱底 24cm² 高 5cm 體積？', answer: '120' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: prismVolume.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: '柱體體積=底面積×高，圓柱=πr²×高' },
    })
  }

  // ─── G6: 負數（negative-numbers）───
  for (const q of [
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
    { prompt: '-8 和 0 之間有幾個整數？', answer: '7' },
    { prompt: '|-7| - |3| = ?', answer: '4' },
    { prompt: '|-5| + |-2| = ?', answer: '7' },
    { prompt: '-1, 0, -3, 2 由小到大排序', answer: '-3,-1,0,2' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: negativeNumbers.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: '負數小於 0，在數線上 0 的左邊；絕對值表示該數到 0 的距離' },
    })
  }

  // ─── G6: 圓錐與圓柱（cone-cylinder）───
  for (const q of [
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
    { prompt: '等底等高的圓柱和圓錐，圓柱體積是圓錐的幾倍？', answer: '3', expl: '圓柱體積=πr²h，圓錐體積=1/3πr²h，所以圓柱是圓錐的 3 倍' },
    { prompt: '等底等高的圓錐體積 30cm³，圓柱體積？', answer: '90' },
    { prompt: '圓柱半徑 6cm、高 2cm，體積？(π=3.14)', answer: '226.08' },
    { prompt: '圓錐半徑 5cm、高 12cm，體積？(π=3.14)', answer: '314' },
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: coneCylinder.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: q.expl ?? '圓柱體積=πr²h，表面積=2πr²+2πrh；圓錐體積=1/3×πr²h' },
    })
  }

  // ═══════════════════════════════════════════════
  // 提升練習題（isChallenge=true）— 各年級加入綜合挑戰題
  // ═══════════════════════════════════════════════
  const allSkills = await prisma.skill.findMany({ where: { isActive: true } })
  const skillByName = new Map(allSkills.map((s) => [s.code, s]))

  const challengeQuestions: { skillCode: string; prompt: string; answer: string; options?: string; expl?: string }[] = [
    // ─── K 級挑戰 ───
    { skillCode: 'count-objects', prompt: '小明有 3 顆蘋果，媽媽又給了他 2 顆，他現在有幾顆？', answer: '5', expl: '3 + 2 = 5' },
    { skillCode: 'shape-recognition', prompt: '下列哪個圖形有 4 個邊？', answer: '正方形', options: '圓形,三角形,正方形,星形' },
    { skillCode: 'count-compare', prompt: '8 和 5 誰比較大？比較大的數減去比較小的數是多少？', answer: '3', expl: '8 - 5 = 3' },

    // ─── G1 挑戰 ───
    { skillCode: 'add-within-10', prompt: '樹上有 2 隻小鳥，又飛來了 6 隻，現在樹上有幾隻小鳥？', answer: '8', expl: '2 + 6 = 8' },
    { skillCode: 'sub-within-10', prompt: '媽媽有 9 顆糖，分給 4 個孩子每人一顆，還剩下幾顆？', answer: '5', expl: '9 - 4 = 5' },
    { skillCode: 'add-within-20', prompt: '停車場有 7 輛車，又開進來 8 輛，停車場現在有幾輛車？', answer: '15', expl: '7 + 8 = 15' },

    // ─── G2 挑戰 ───
    { skillCode: 'intro-multiply', prompt: '每張桌子有 4 隻腳，6 張桌子共有幾隻腳？', answer: '24', expl: '4 × 6 = 24' },
    { skillCode: 'multiply-6-9', prompt: '一週有 7 天，8 週共有幾天？', answer: '56', expl: '7 × 8 = 56' },
    { skillCode: 'multiply-table', prompt: '9 × 9 = ?', answer: '81', expl: '九九乘法：9 × 9 = 81' },
    { skillCode: 'divide-basic', prompt: '48 顆糖果平分給 6 個人，每人拿到幾顆？', answer: '8', expl: '48 ÷ 6 = 8' },
    { skillCode: 'word-problem', prompt: '一枝筆 7 元，小明買了 5 枝，共花了多少元？', answer: '35', expl: '7 × 5 = 35' },

    // ─── G3 挑戰 ───
    { skillCode: 'add-sub-100', prompt: '小美有 156 元，買文具花了 78 元，還剩下多少元？', answer: '78', expl: '156 - 78 = 78' },
    { skillCode: 'mixed-operations', prompt: '36 ÷ 4 + 5 × 3 = ?', answer: '24', expl: '先算 36÷4=9，再算 5×3=15，最後 9+15=24' },
    { skillCode: 'time-calc', prompt: '上午 9:30 到下午 2:15，經過了幾小時幾分？', answer: '4h45m', expl: '9:30→14:15 共 4 小時 45 分鐘' },
    { skillCode: 'area-perimeter', prompt: '長方形長 12cm、寬 8cm，周長和面積各是多少？', answer: '40,96', expl: '周長=2×(12+8)=40cm，面積=12×8=96cm²', options: '40,96,20,48,96,40' },

    // ─── G4 挑戰 ───
    { skillCode: 'decimal-intro', prompt: '12.5 + 3.7 = ?', answer: '16.2', expl: '對齊小數點：12.5 + 3.7 = 16.2' },
    { skillCode: 'large-multiply', prompt: '23 × 45 = ?', answer: '1035', expl: '23 × 45 = 23 × (40+5) = 920 + 115 = 1035' },
    { skillCode: 'triangle', prompt: '三角形的三個角分別是 45°、60°、75°，這是一個什麼三角形？', answer: '銳角三角形', expl: '三個角都小於 90°，所以是銳角三角形', options: '銳角三角形,直角三角形,鈍角三角形,等腰三角形' },
    { skillCode: 'two-digit-div', prompt: '144 ÷ 12 = ?', answer: '12', expl: '12 × 12 = 144' },

    // ─── G5 挑戰 ───
    { skillCode: 'decimal-multiply-divide', prompt: '3.6 × 2.5 = ?', answer: '9', expl: '3.6 × 2.5 = 9' },
    { skillCode: 'factors-multiples', prompt: '12 和 18 的最小公倍數是多少？', answer: '36', expl: '12=2²×3，18=2×3²，最小公倍數=2²×3²=36' },
    { skillCode: 'equation', prompt: '解方程：3x + 7 = 22，x = ?', answer: '5', expl: '3x + 7 = 22 → 3x = 15 → x = 5' },
    { skillCode: 'polygon-formula', prompt: '三角形底 10cm、高 8cm，面積是多少？', answer: '40', expl: '三角形面積 = 底 × 高 ÷ 2 = 10 × 8 ÷ 2 = 40cm²' },

    // ─── G6 挑戰 ───
    { skillCode: 'fraction-multiply-divide', prompt: '2/3 × 3/4 = ? （請輸入分數 a/b 格式）', answer: '1/2', expl: '2/3 × 3/4 = 6/12 = 1/2' },
    { skillCode: 'ratio', prompt: '甲：乙 = 3：2，甲有 30 元，乙有多少元？', answer: '20', expl: '3:2 = 30:乙 → 乙 = 30 × 2 ÷ 3 = 20' },
    { skillCode: 'fraction-multiply-divide', prompt: '5/6 ÷ 2/3 = ? （請輸入分數 a/b 格式）', answer: '5/4', expl: '5/6 ÷ 2/3 = 5/6 × 3/2 = 15/12 = 5/4' },
    { skillCode: 'ratio', prompt: '地圖比例尺 1:50000，兩地圖上距離 4cm，實際距離多少公里？', answer: '2', expl: '4 × 50000 = 200000cm = 2km' },
  ]

  for (const q of challengeQuestions) {
    const skill = skillByName.get(q.skillCode)
    if (!skill) {
      console.warn(`  ⚠ 未找到技能 ${q.skillCode}，跳過挑戰題`)
      continue
    }
    await prisma.questionTemplate.create({
      data: {
        skillId: skill.id,
        type: q.options ? 'DIRECT' : 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        options: q.options ?? null,
        explanation: q.expl ?? null,
        isChallenge: true,
      },
    })
  }

  // 更新成功訊息
  const totalQ = await prisma.questionTemplate.count()
  const totalChallenge = await prisma.questionTemplate.count({ where: { isChallenge: true } })
  console.log(`  ✓ Badges: ${badges.length} seeded`)
  console.log(`  ✓ Skills from K to G6, Questions: ${totalQ} (including ${totalChallenge} challenge)`)
  console.log('✅ Done!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
