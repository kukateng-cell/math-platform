import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding...')

  // ============ 管理員帳號 ============
  const adminHash = await bcrypt.hash('admin123', 10)
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
  console.log(`  ✓ Admin: ${admin.email} / admin123`)

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

  // ============ G3 三年級技能 ============
  const threeDigitAddSub = await prisma.skill.upsert({
    where: { code: 'three-digit-add-sub' },
    update: { order: 12, prerequisiteId: addWithin20.id },
    create: {
      code: 'three-digit-add-sub',
      name: '三位數加減',
      description: '三位數的進位加法與退位減法',
      gradeLevel: 'G3',
      order: 12,
      prerequisiteId: addWithin20.id,
    },
  })

  const introFraction = await prisma.skill.upsert({
    where: { code: 'intro-fraction' },
    update: { order: 13, prerequisiteId: divideBasic.id },
    create: {
      code: 'intro-fraction',
      name: '分數入門',
      description: '認識分數：等分概念、真分數與帶分數',
      gradeLevel: 'G3',
      order: 13,
      prerequisiteId: divideBasic.id,
    },
  })

  const timeCalc = await prisma.skill.upsert({
    where: { code: 'time-calc' },
    update: { order: 14, prerequisiteId: wordProblem.id },
    create: {
      code: 'time-calc',
      name: '時間計算',
      description: '時、分、秒的換算與時間間隔計算',
      gradeLevel: 'G3',
      order: 14,
      prerequisiteId: wordProblem.id,
    },
  })

  const areaPerimeter = await prisma.skill.upsert({
    where: { code: 'area-perimeter' },
    update: { order: 15, prerequisiteId: introMultiply.id },
    create: {
      code: 'area-perimeter',
      name: '面積與周長',
      description: '長方形和正方形的面積與周長計算',
      gradeLevel: 'G3',
      order: 15,
      prerequisiteId: introMultiply.id,
    },
  })

  // ============ G4 四年級技能 ============
  const largeMultiply = await prisma.skill.upsert({
    where: { code: 'large-multiply' },
    update: { order: 16, prerequisiteId: multiplyTable.id },
    create: {
      code: 'large-multiply',
      name: '多位數乘法',
      description: '兩位數乘以兩位數的直式乘法',
      gradeLevel: 'G4',
      order: 16,
      prerequisiteId: multiplyTable.id,
    },
  })

  const longDivision = await prisma.skill.upsert({
    where: { code: 'long-division' },
    update: { order: 17, prerequisiteId: divideBasic.id },
    create: {
      code: 'long-division',
      name: '直式除法',
      description: '兩位數除以一位數的直式除法（含餘數）',
      gradeLevel: 'G4',
      order: 17,
      prerequisiteId: divideBasic.id,
    },
  })

  const fractionCompare = await prisma.skill.upsert({
    where: { code: 'fraction-compare' },
    update: { order: 18, prerequisiteId: introFraction.id },
    create: {
      code: 'fraction-compare',
      name: '分數比較與加減',
      description: '同分母分數比較、同分母分數加減',
      gradeLevel: 'G4',
      order: 18,
      prerequisiteId: introFraction.id,
    },
  })

  const decimalIntro = await prisma.skill.upsert({
    where: { code: 'decimal-intro' },
    update: { order: 19, prerequisiteId: introFraction.id },
    create: {
      code: 'decimal-intro',
      name: '認識小數',
      description: '認識小數位值、小數與分數的轉換、小數加減',
      gradeLevel: 'G4',
      order: 19,
      prerequisiteId: introFraction.id,
    },
  })

  // ============ G4 新增技能（6 種新題型）============
  const largeNumbers = await prisma.skill.upsert({
    where: { code: 'large-numbers' },
    update: { order: 20, prerequisiteId: decimalIntro.id },
    create: {
      code: 'large-numbers',
      name: '大數認識',
      description: '億以內/以上的數：讀寫、比較、位值與近似數',
      gradeLevel: 'G4',
      order: 20,
      prerequisiteId: decimalIntro.id,
    },
  })

  const threeByTwoMul = await prisma.skill.upsert({
    where: { code: 'three-by-two-mul' },
    update: { order: 21, prerequisiteId: largeMultiply.id },
    create: {
      code: 'three-by-two-mul',
      name: '三位數乘兩位數',
      description: '三位數乘以兩位數的直式乘法與估算',
      gradeLevel: 'G4',
      order: 21,
      prerequisiteId: largeMultiply.id,
    },
  })

  const twoDigitDiv = await prisma.skill.upsert({
    where: { code: 'two-digit-div' },
    update: { order: 22, prerequisiteId: longDivision.id },
    create: {
      code: 'two-digit-div',
      name: '兩位數除法',
      description: '除數是兩位數的直式除法（含商不變的規律）',
      gradeLevel: 'G4',
      order: 22,
      prerequisiteId: longDivision.id,
    },
  })

  const arithmeticLaws = await prisma.skill.upsert({
    where: { code: 'arithmetic-laws' },
    update: { order: 23, prerequisiteId: threeByTwoMul.id },
    create: {
      code: 'arithmetic-laws',
      name: '運算定律',
      description: '加法/乘法的交換律、結合律與分配律',
      gradeLevel: 'G4',
      order: 23,
      prerequisiteId: threeByTwoMul.id,
    },
  })

  const decimalProperty = await prisma.skill.upsert({
    where: { code: 'decimal-property' },
    update: { order: 24, prerequisiteId: decimalIntro.id },
    create: {
      code: 'decimal-property',
      name: '小數性質與計算',
      description: '小數的性質（末尾補0）、進階加減、四捨五入與比較',
      gradeLevel: 'G4',
      order: 24,
      prerequisiteId: decimalIntro.id,
    },
  })

  const triangle = await prisma.skill.upsert({
    where: { code: 'triangle' },
    update: { order: 25, prerequisiteId: areaPerimeter.id },
    create: {
      code: 'triangle',
      name: '三角形',
      description: '三角形的分類、內角和、兩邊之和大於第三邊、面積計算',
      gradeLevel: 'G4',
      order: 25,
      prerequisiteId: areaPerimeter.id,
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
    { symbol: '□', name: '正方形', feature: '四條邊一樣長，四個角都是直角' },
    { symbol: '○', name: '圓形', feature: '圓圓的，沒有角也沒有邊' },
    { symbol: '△', name: '三角形', feature: '有三條邊和三個角' },
    { symbol: '▭', name: '長方形', feature: '有四條邊，對邊一樣長，四個角都是直角' },
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

  // ═══════════════════════════════════════════════
  // G3 三年級題庫
  // ═══════════════════════════════════════════════

  // ───────── 三位數加減（three-digit-add-sub）: 參數化模板 ─────────
  const threeDigitTemplates = [
    { prompt: '{a} + {b} = ?', params: { aMin: 100, aMax: 500, bMin: 100, bMax: 500, sumMax: 999 }, expl: '三位數加法：先加百位，再加十位，最後加個位，注意進位。' },
    { prompt: '{a} + {b} = ?', params: { aMin: 200, aMax: 700, bMin: 50, bMax: 250, sumMax: 999 }, expl: '三位數加兩位數：把兩位數拆成十位和個位，分別相加。' },
    { prompt: '{a} - {b} = ?', params: { aMin: 200, aMax: 999, bMin: 50, bMax: 400 }, expl: '三位數減法：先減百位，再減十位，最後減個位，注意退位。' },
  ]
  for (const t of threeDigitTemplates) {
    await prisma.questionTemplate.create({
      data: {
        skillId: threeDigitAddSub.id,
        type: t.prompt.includes('+') ? 'ADD' : 'SUB',
        prompt: t.prompt,
        paramsJson: JSON.stringify(t.params),
        answer: t.prompt.includes('+') ? '{a+b}' : '{a-b}',
        explanation: t.expl,
      },
    })
  }

  // 三位數加減直接題
  const threeDigitDirect: { prompt: string; answer: string; expl: string }[] = [
    { prompt: '123 + 456 = ?', answer: '579', expl: '百位：1+4=5，十位：2+5=7，個位：3+6=9，合起來是 579' },
    { prompt: '234 + 567 = ?', answer: '801', expl: '個位 4+7=11 進 1，十位 3+6+1=10 進 1，百位 2+5+1=8，答案是 801' },
    { prompt: '345 + 278 = ?', answer: '623', expl: '個位 5+8=13 進 1，十位 4+7+1=12 進 1，百位 3+2+1=6，答案是 623' },
    { prompt: '789 - 456 = ?', answer: '333', expl: '百位：7-4=3，十位：8-5=3，個位：9-6=3，答案是 333' },
    { prompt: '632 - 248 = ?', answer: '384', expl: '個位 2 不夠減 8，向十位借 1 變 12-8=4；十位剩 2 不夠減 4，向百位借 1 變 12-4=8；百位剩 5-2=3，答案是 384' },
    { prompt: '500 - 167 = ?', answer: '333', expl: '個位 0 不夠減 7，連續借位：500 - 167 = 333' },
    { prompt: '326 + 474 = ?', answer: '800', expl: '326 + 474 = 800，剛好湊成整百' },
    { prompt: '851 - 358 = ?', answer: '493', expl: '851 - 358 = 493，需要退位減法' },
    { prompt: '268 + 199 = ?', answer: '467', expl: '268 + 199 = 467，用湊整法：268 + 200 - 1 = 467' },
    { prompt: '703 - 205 = ?', answer: '498', expl: '703 - 205 = 498，百位 7-2=5，但需要處理退位' },
  ]
  for (const q of threeDigitDirect) {
    await prisma.questionTemplate.create({
      data: {
        skillId: threeDigitAddSub.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: q.expl,
      },
    })
  }

  // ───────── 分數入門（intro-fraction）: 20+ 題 ─────────
  const fractionDirect: { prompt: string; answer: string; expl: string }[] = [
    { prompt: '一個圓形披薩平分成 4 塊，吃了 1 塊，吃了幾分之幾個披薩？', answer: '1/4', expl: '把一個披薩平分成 4 份，吃了 1 份就是 1/4' },
    { prompt: '一條繩子平分成 5 段，用了 3 段，用了幾分之幾？', answer: '3/5', expl: '平分成 5 份，用了 3 份，就是 3/5' },
    { prompt: '一個蛋糕平分成 8 塊，吃了 3 塊，吃了幾分之幾？', answer: '3/8', expl: '平分成 8 份，吃了 3 份，就是 3/8' },
    { prompt: '把一條緞帶平分成 6 段，用了 2 段，用了幾分之幾？', answer: '2/6', expl: '2/6，也就是 1/3，但先寫 2/6' },
    { prompt: '1/4 和 3/4，哪一個比較大？', answer: '3/4', expl: '分母相同都是 4，分子 3 > 1，所以 3/4 比較大' },
    { prompt: '2/5 + 1/5 = ?', answer: '3/5', expl: '分母相同（5），分子相加：2+1=3，所以是 3/5' },
    { prompt: '3/7 + 2/7 = ?', answer: '5/7', expl: '分母相同（7），分子相加：3+2=5，所以是 5/7' },
    { prompt: '4/9 - 1/9 = ?', answer: '3/9', expl: '分母相同（9），分子相減：4-1=3，所以是 3/9' },
    { prompt: '5/8 - 2/8 = ?', answer: '3/8', expl: '分母相同（8），分子相減：5-2=3，所以是 3/8' },
    { prompt: '1 個披薩平分成 3 塊，2 塊是幾分之幾？', answer: '2/3', expl: '平分成 3 份，2 份就是 2/3' },
    { prompt: '12 顆糖果平分成 4 份，每份是幾分之幾？有幾顆？', answer: '1/4', expl: '平分成 4 份，每份是 1/4；12÷4=3，每份 3 顆' },
    { prompt: '1/2 和 1/3，哪一個比較大？', answer: '1/2', expl: '分子相同都是 1，分母越小代表每一份越大，所以 1/2 > 1/3' },
    { prompt: '2/3 和 2/5，哪一個比較大？', answer: '2/3', expl: '分子相同都是 2，分母 3 < 5，所以 2/3 > 2/5' },
    { prompt: '3/4 = ?/8，? 是多少？', answer: '6', expl: '分子分母同時乘以 2：3×2=6，4×2=8，所以 3/4 = 6/8' },
    { prompt: '1/2 = ?/6，? 是多少？', answer: '3', expl: '分子分母同時乘以 3：1×3=3，2×3=6，所以 1/2 = 3/6' },
    { prompt: '7/10 - 3/10 = ?', answer: '4/10', expl: '同分母減法：7-3=4，所以是 4/10' },
    { prompt: '2/6 + 3/6 = ?', answer: '5/6', expl: '同分母加法：2+3=5，所以是 5/6' },
    { prompt: '1 可以寫成幾分之幾？5/5 還是 6/5？', answer: '5/5', expl: '1 = 5/5，分子等於分母時等於 1' },
    { prompt: '3/3 + 1/3 = ?', answer: '4/3', expl: '3/3 + 1/3 = 4/3，也就是 1 又 1/3' },
    { prompt: '6/8 約分後是幾分之幾？', answer: '3/4', expl: '6/8 的分子分母同時除以 2：6÷2=3，8÷2=4，所以是 3/4' },
  ]
  for (const q of fractionDirect) {
    await prisma.questionTemplate.create({
      data: {
        skillId: introFraction.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: q.expl,
      },
    })
  }

  // ───────── 時間計算（time-calc）: 15+ 題 ─────────
  const timeDirect: { prompt: string; answer: string; expl: string }[] = [
    { prompt: '1 小時 = 幾分鐘？', answer: '60', expl: '1 小時 = 60 分鐘' },
    { prompt: '3 小時 = 幾分鐘？', answer: '180', expl: '3 × 60 = 180 分鐘' },
    { prompt: '120 分鐘 = 幾小時？', answer: '2', expl: '120 ÷ 60 = 2 小時' },
    { prompt: '從上午 9:00 到上午 10:30，經過了多久？', answer: '1小時30分鐘', expl: '從 9:00 到 10:00 是 1 小時，再到 10:30 是 30 分鐘，共 1 小時 30 分鐘' },
    { prompt: '從下午 2:15 到下午 3:45，經過了多久？', answer: '1小時30分鐘', expl: '從 2:15 到 3:15 是 1 小時，再到 3:45 是 30 分鐘，共 1 小時 30 分鐘' },
    { prompt: '電影從 7:30 開始，長度 2 小時，幾點結束？', answer: '9:30', expl: '7:30 + 2 小時 = 9:30' },
    { prompt: '1 分鐘 = 幾秒？', answer: '60', expl: '1 分鐘 = 60 秒' },
    { prompt: '5 分鐘 = 幾秒？', answer: '300', expl: '5 × 60 = 300 秒' },
    { prompt: '180 秒 = 幾分鐘？', answer: '3', expl: '180 ÷ 60 = 3 分鐘' },
    { prompt: '上午 8:45 到上午 9:15 經過多久？', answer: '30分鐘', expl: '從 8:45 到 9:00 是 15 分鐘，再到 9:15 又是 15 分鐘，共 30 分鐘' },
    { prompt: '2 天 = 幾小時？', answer: '48', expl: '1 天 = 24 小時，2 × 24 = 48 小時' },
    { prompt: '半年 = 幾個月？', answer: '6', expl: '1 年 = 12 個月，半年 = 6 個月' },
    { prompt: '3 年 = 幾個月？', answer: '36', expl: '3 × 12 = 36 個月' },
    { prompt: '1 年 = 幾天？（不考慮閏年）', answer: '365', expl: '1 年通常有 365 天' },
    { prompt: '從中午 12:00 到下午 6:30 經過多久？', answer: '6小時30分鐘', expl: '12:00 到 6:00 是 6 小時，再加 30 分鐘是 6 小時 30 分鐘' },
  ]
  for (const q of timeDirect) {
    await prisma.questionTemplate.create({
      data: {
        skillId: timeCalc.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: q.expl,
      },
    })
  }

  // ───────── 面積與周長（area-perimeter）: 15+ 題 ─────────
  const areaDirect: { prompt: string; answer: string; expl: string }[] = [
    { prompt: '一個長方形長 5 公分、寬 3 公分，周長是多少？', answer: '16', expl: '周長 = (長 + 寬) × 2 = (5+3) × 2 = 16 公分' },
    { prompt: '一個正方形邊長 4 公分，周長是多少？', answer: '16', expl: '正方形周長 = 邊長 × 4 = 4 × 4 = 16 公分' },
    { prompt: '一個長方形長 6 公分、寬 4 公分，面積是多少？', answer: '24', expl: '面積 = 長 × 寬 = 6 × 4 = 24 平方公分' },
    { prompt: '一個正方形邊長 5 公分，面積是多少？', answer: '25', expl: '正方形面積 = 邊長 × 邊長 = 5 × 5 = 25 平方公分' },
    { prompt: '一個長方形長 8 公尺、寬 3 公尺，周長是多少？', answer: '22', expl: '周長 = (8+3) × 2 = 22 公尺' },
    { prompt: '一個長方形長 7 公分、寬 2 公分，面積是多少？', answer: '14', expl: '面積 = 7 × 2 = 14 平方公分' },
    { prompt: '一個正方形周長 20 公分，邊長是多少？', answer: '5', expl: '邊長 = 周長 ÷ 4 = 20 ÷ 4 = 5 公分' },
    { prompt: '一個長方形面積 18 平方公分，長 6 公分，寬是多少？', answer: '3', expl: '寬 = 面積 ÷ 長 = 18 ÷ 6 = 3 公分' },
    { prompt: '一個長方形長 9 公尺、寬 6 公尺，面積是多少？', answer: '54', expl: '面積 = 9 × 6 = 54 平方公尺' },
    { prompt: '一個正方形邊長 10 公分，面積是多少？', answer: '100', expl: '面積 = 10 × 10 = 100 平方公分' },
    { prompt: '一個長方形長 12 公分、寬 5 公分，周長是多少？', answer: '34', expl: '周長 = (12+5) × 2 = 34 公分' },
    { prompt: '一個正方形邊長 7 公分，周長和面積各是多少？（答案格式：周長,面積）', answer: '28,49', expl: '周長 = 7×4 = 28 公分，面積 = 7×7 = 49 平方公分' },
    { prompt: '一個長方形長 15 公分、寬 10 公分，面積是多少？', answer: '150', expl: '面積 = 15 × 10 = 150 平方公分' },
    { prompt: '一個正方形邊長 6 公尺，周長是多少？', answer: '24', expl: '周長 = 6 × 4 = 24 公尺' },
    { prompt: '一個長方形長 20 公分、寬 8 公分，周長是多少？', answer: '56', expl: '周長 = (20+8) × 2 = 56 公分' },
  ]
  for (const q of areaDirect) {
    await prisma.questionTemplate.create({
      data: {
        skillId: areaPerimeter.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: q.expl,
      },
    })
  }

  // ═══════════════════════════════════════════════
  // G4 四年級題庫
  // ═══════════════════════════════════════════════

  // ───────── 多位數乘法（large-multiply）: 參數化模板 + 直接題 ─────────
  const largeMulTemplates = [
    { prompt: '{a} × {b} = ?', params: { aMin: 11, aMax: 99, bMin: 2, bMax: 9 }, expl: '兩位數乘以一位數：先用個位乘，再用十位乘，最後相加。' },
    { prompt: '{a} × {b} = ?', params: { aMin: 11, aMax: 99, bMin: 11, bMax: 99 }, expl: '兩位數乘以兩位數：用直式乘法，先乘個位再乘十位。' },
  ]
  for (const t of largeMulTemplates) {
    await prisma.questionTemplate.create({
      data: {
        skillId: largeMultiply.id,
        type: 'MUL',
        prompt: t.prompt,
        paramsJson: JSON.stringify(t.params),
        answer: '{a*b}',
        explanation: t.expl,
      },
    })
  }

  const largeMulDirect: { prompt: string; answer: string; expl: string }[] = [
    { prompt: '23 × 4 = ?', answer: '92', expl: '23 × 4 = (20×4) + (3×4) = 80 + 12 = 92' },
    { prompt: '45 × 6 = ?', answer: '270', expl: '45 × 6 = (40×6) + (5×6) = 240 + 30 = 270' },
    { prompt: '56 × 7 = ?', answer: '392', expl: '56 × 7 = (50×7) + (6×7) = 350 + 42 = 392' },
    { prompt: '12 × 12 = ?', answer: '144', expl: '12 × 12 = 144，這是常用的平方數' },
    { prompt: '15 × 15 = ?', answer: '225', expl: '15 × 15 = 225，要記住這個平方數！' },
    { prompt: '24 × 13 = ?', answer: '312', expl: '24 × 13 = 24×10 + 24×3 = 240 + 72 = 312' },
    { prompt: '36 × 25 = ?', answer: '900', expl: '36 × 25 = 36×100÷4 = 3600÷4 = 900' },
    { prompt: '42 × 11 = ?', answer: '462', expl: '42 × 11 = 42×10 + 42 = 420 + 42 = 462' },
    { prompt: '67 × 8 = ?', answer: '536', expl: '67 × 8 = (60×8) + (7×8) = 480 + 56 = 536' },
    { prompt: '99 × 9 = ?', answer: '891', expl: '99 × 9 = (100×9) - (1×9) = 900 - 9 = 891' },
    { prompt: '18 × 14 = ?', answer: '252', expl: '18 × 14 = 18×10 + 18×4 = 180 + 72 = 252' },
    { prompt: '25 × 32 = ?', answer: '800', expl: '25 × 32 = 25×4×8 = 100×8 = 800' },
  ]
  for (const q of largeMulDirect) {
    await prisma.questionTemplate.create({
      data: {
        skillId: largeMultiply.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: q.expl,
      },
    })
  }

  // ───────── 直式除法（long-division）: 參數化模板 + 直接題 ─────────
  const longDivTemplates = [
    { prompt: '{a} ÷ {b} = ?', params: { aMin: 20, aMax: 99, bMin: 2, bMax: 9, aMultipleOfB: true }, expl: '兩位數除以一位數，用直式除法由高位往低位算。' },
    { prompt: '{a} ÷ {b} = ?⋯⋯?', params: { aMin: 20, aMax: 99, bMin: 3, bMax: 9, aMultipleOfB: false }, expl: '有餘數的除法：被除數 ÷ 除數 = 商⋯⋯餘數，餘數要比除數小。' },
  ]
  for (const t of longDivTemplates) {
    await prisma.questionTemplate.create({
      data: {
        skillId: longDivision.id,
        type: 'DIV',
        prompt: t.prompt,
        paramsJson: JSON.stringify(t.params),
        answer: t.params.aMultipleOfB ? '{a/b}' : '{a/b}⋯⋯{a%b}',
        explanation: t.expl,
      },
    })
  }

  const longDivDirect: { prompt: string; answer: string; expl: string }[] = [
    { prompt: '48 ÷ 4 = ?', answer: '12', expl: '48 ÷ 4 = 12，十位 4÷4=1，個位 8÷4=2' },
    { prompt: '72 ÷ 6 = ?', answer: '12', expl: '72 ÷ 6 = 12，6×12=72' },
    { prompt: '84 ÷ 7 = ?', answer: '12', expl: '84 ÷ 7 = 12，7×12=84' },
    { prompt: '96 ÷ 8 = ?', answer: '12', expl: '96 ÷ 8 = 12，8×12=96' },
    { prompt: '56 ÷ 4 = ?', answer: '14', expl: '56 ÷ 4 = 14，4×14=56' },
    { prompt: '65 ÷ 5 = ?', answer: '13', expl: '65 ÷ 5 = 13，5×13=65' },
    { prompt: '50 ÷ 3 = ?⋯⋯?', answer: '16⋯⋯2', expl: '3×16=48，50-48=2，所以 50÷3=16⋯⋯2' },
    { prompt: '37 ÷ 5 = ?⋯⋯?', answer: '7⋯⋯2', expl: '5×7=35，37-35=2，所以 37÷5=7⋯⋯2' },
    { prompt: '43 ÷ 6 = ?⋯⋯?', answer: '7⋯⋯1', expl: '6×7=42，43-42=1，所以 43÷6=7⋯⋯1' },
    { prompt: '29 ÷ 4 = ?⋯⋯?', answer: '7⋯⋯1', expl: '4×7=28，29-28=1，所以 29÷4=7⋯⋯1' },
    { prompt: '90 ÷ 7 = ?⋯⋯?', answer: '12⋯⋯6', expl: '7×12=84，90-84=6，所以 90÷7=12⋯⋯6' },
    { prompt: '51 ÷ 3 = ?', answer: '17', expl: '51 ÷ 3 = 17，3×17=51' },
  ]
  for (const q of longDivDirect) {
    await prisma.questionTemplate.create({
      data: {
        skillId: longDivision.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: q.expl,
      },
    })
  }

  // ───────── 分數比較與加減（fraction-compare）: 15+ 題 ─────────
  const fractionCompDirect: { prompt: string; answer: string; expl: string }[] = [
    { prompt: '3/8 + 2/8 = ?', answer: '5/8', expl: '同分母分數相加：3+2=5，分母不變，所以是 5/8' },
    { prompt: '7/12 - 4/12 = ?', answer: '3/12', expl: '同分母分數相減：7-4=3，分母不變，所以是 3/12' },
    { prompt: '2/6 + 3/6 = ?', answer: '5/6', expl: '2/6 + 3/6 = 5/6' },
    { prompt: '5/9 + 2/9 = ?', answer: '7/9', expl: '5/9 + 2/9 = 7/9' },
    { prompt: '8/15 - 3/15 = ?', answer: '5/15', expl: '8/15 - 3/15 = 5/15，約分後是 1/3' },
    { prompt: '3/5 和 3/7 哪個大？', answer: '3/5', expl: '分子相同（都是 3），分母越小分數越大，5 < 7，所以 3/5 > 3/7' },
    { prompt: '5/8 和 3/8 哪個大？', answer: '5/8', expl: '分母相同（都是 8），分子越大分數越大，5 > 3，所以 5/8 > 3/8' },
    { prompt: '1/3 + 1/3 + 1/3 = ?', answer: '1', expl: '三個 1/3 加起來 = 3/3 = 1' },
    { prompt: '3/4 - 1/4 = ?', answer: '2/4', expl: '3/4 - 1/4 = 2/4，約分後是 1/2' },
    { prompt: '2/7 + 5/7 = ?', answer: '1', expl: '2/7 + 5/7 = 7/7 = 1' },
    { prompt: '4/10 + 6/10 = ?', answer: '1', expl: '4/10 + 6/10 = 10/10 = 1' },
    { prompt: '7/10 和 7/12 哪個大？', answer: '7/10', expl: '分子相同（都是 7），分母越小分數越大，10 < 12，所以 7/10 > 7/12' },
    { prompt: '1/2 + 1/4 = ?（提示：先通分）', answer: '3/4', expl: '1/2 = 2/4，2/4 + 1/4 = 3/4' },
    { prompt: '1/3 + 1/6 = ?', answer: '3/6', expl: '1/3 = 2/6，2/6 + 1/6 = 3/6 = 1/2' },
    { prompt: '2/5 + 1/10 = ?', answer: '5/10', expl: '2/5 = 4/10，4/10 + 1/10 = 5/10 = 1/2' },
  ]
  for (const q of fractionCompDirect) {
    await prisma.questionTemplate.create({
      data: {
        skillId: fractionCompare.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: q.expl,
      },
    })
  }

  // ───────── 認識小數（decimal-intro）: 15+ 題 ─────────
  const decimalDirect: { prompt: string; answer: string; expl: string }[] = [
    { prompt: '1/10 用小數怎麼寫？', answer: '0.1', expl: '1/10 = 0.1，十分之一就是 0.1' },
    { prompt: '3/10 用小數怎麼寫？', answer: '0.3', expl: '3/10 = 0.3' },
    { prompt: '7/100 用小數怎麼寫？', answer: '0.07', expl: '7/100 = 0.07，百分之七就是 0.07' },
    { prompt: '0.5 化為分數是多少？', answer: '1/2', expl: '0.5 = 5/10 = 1/2' },
    { prompt: '0.25 化為分數是多少？', answer: '1/4', expl: '0.25 = 25/100 = 1/4' },
    { prompt: '0.3 + 0.4 = ?', answer: '0.7', expl: '0.3 + 0.4 = 0.7，小數加法對齊小數點' },
    { prompt: '0.8 - 0.3 = ?', answer: '0.5', expl: '0.8 - 0.3 = 0.5' },
    { prompt: '0.6 + 0.07 = ?', answer: '0.67', expl: '0.6 + 0.07 = 0.67，十分位加十分位，百分位加百分位' },
    { prompt: '0.9 - 0.4 = ?', answer: '0.5', expl: '0.9 - 0.4 = 0.5' },
    { prompt: '0.35 + 0.24 = ?', answer: '0.59', expl: '0.35 + 0.24 = 0.59，百分位 5+4=9，十分位 3+2=5' },
    { prompt: '0.75 - 0.25 = ?', answer: '0.5', expl: '0.75 - 0.25 = 0.50 = 0.5' },
    { prompt: '0.4 和 0.04 哪個大？', answer: '0.4', expl: '0.4 = 0.40，40 > 4，所以 0.4 > 0.04' },
    { prompt: '0.6 和 0.60 哪個大？', answer: '一樣大', expl: '0.6 = 0.60，在尾數加 0 不改變小數的大小' },
    { prompt: '1.5 + 2.3 = ?', answer: '3.8', expl: '1.5 + 2.3 = 3.8，整數加整數，小數加小數' },
    { prompt: '4.8 - 1.6 = ?', answer: '3.2', expl: '4.8 - 1.6 = 3.2' },
    { prompt: '0.1 × 7 = ?', answer: '0.7', expl: '0.1 × 7 = 0.7，就是把 0.1 加 7 次' },
    { prompt: '0.6 ÷ 3 = ?', answer: '0.2', expl: '0.6 ÷ 3 = 0.2，把 0.6 平分成 3 份' },
  ]
  for (const q of decimalDirect) {
    await prisma.questionTemplate.create({
      data: {
        skillId: decimalIntro.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: q.expl,
      },
    })
  }

  // ═══════════════════════════════════════════════
  // G4 新增題庫（6 種新題型）
  // ═══════════════════════════════════════════════

  // ───────── 大數認識（large-numbers）: 20+ 題 ─────────
  const largeNumDirect: { prompt: string; answer: string; expl: string }[] = [
    { prompt: '10 個一千是多少？', answer: '一萬', expl: '10 × 1000 = 10000，也就是一萬' },
    { prompt: '10 個一萬是多少？', answer: '十萬', expl: '10 × 10000 = 100000，也就是十萬' },
    { prompt: '10 個十萬是多少？', answer: '一百萬', expl: '10 × 100000 = 1000000，也就是一百萬' },
    { prompt: '10 個一百萬是多少？', answer: '一千萬', expl: '10 個一百萬 = 一千萬' },
    { prompt: '10 個一千萬是多少？', answer: '一億', expl: '10 個一千萬 = 一億' },
    { prompt: '一億是幾個一千萬？', answer: '10', expl: '一億 = 10 個一千萬' },
    { prompt: '10000000 怎麼讀？', answer: '一千萬', expl: '10000000 讀作「一千萬」' },
    { prompt: '123456789 讀作什麼？', answer: '一億二千三百四十五萬六千七百八十九', expl: '從高位讀起：一億二千三百四十五萬六千七百八十九' },
    { prompt: '「五千零八十萬」寫成數字是多少？', answer: '50800000', expl: '五千零八十萬 = 50800000' },
    { prompt: '「三億五千萬」寫成數字是多少？', answer: '350000000', expl: '三億五千萬 = 350000000' },
    { prompt: '56789123 這個數最高位是什麼位？', answer: '千萬位', expl: '56789123 是八位數，最高位是千萬位' },
    { prompt: '45000000 和 4500000，哪個比較大？', answer: '45000000', expl: '45000000 是八位數，4500000 是七位數，位數越多數越大' },
    { prompt: '約 1300000000 人，這個數怎麼讀？', answer: '十三億', expl: '1300000000 讀作「十三億」' },
    { prompt: '一萬後面加 4 個 0 是多少？', answer: '一億', expl: '10000 後面加 4 個 0 = 100000000 = 一億' },
    { prompt: '一個八位數的最高位是什麼位？', answer: '千萬位', expl: '八位數的位名依序：千萬、百萬、十萬、萬、千、百、十、個' },
    { prompt: '92000000 改寫成「萬」為單位是多少？', answer: '9200萬', expl: '92000000 = 9200 萬' },
    { prompt: '123000000 改寫成「億」為單位是多少？', answer: '1.23億', expl: '123000000 = 1.23 億' },
    { prompt: '最大的八位數是多少？', answer: '99999999', expl: '八位數最大就是 9 個位數都填 9：99999999' },
    { prompt: '最小的九位數是多少？', answer: '100000000', expl: '最小的九位數是 100000000（一億）' },
    { prompt: '53764000 ≈ ?（四捨五入到萬位）', answer: '5376萬', expl: '千位是 4 < 5，所以捨去，約 5376 萬' },
  ]
  for (const q of largeNumDirect) {
    await prisma.questionTemplate.create({
      data: {
        skillId: largeNumbers.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: q.expl,
      },
    })
  }

  // ───────── 三位數乘兩位數（three-by-two-mul）: 參數化 + 直接題 ─────────
  const threeByTwoTemplates = [
    { prompt: '{a} × {b} = ?', params: { aMin: 100, aMax: 999, bMin: 11, bMax: 99 }, expl: '三位數乘以兩位數：先用個位乘，再用十位乘，最後相加。' },
    { prompt: '{a} × {b} = ?', params: { aMin: 100, aMax: 500, bMin: 11, bMax: 50 }, expl: '先用估算法確認範圍，再用直式精確計算。' },
  ]
  for (const t of threeByTwoTemplates) {
    await prisma.questionTemplate.create({
      data: {
        skillId: threeByTwoMul.id,
        type: 'MUL',
        prompt: t.prompt,
        paramsJson: JSON.stringify(t.params),
        answer: '{a*b}',
        explanation: t.expl,
      },
    })
  }

  const threeByTwoDirect: { prompt: string; answer: string; expl: string }[] = [
    { prompt: '123 × 12 = ?', answer: '1476', expl: '123 × 12 = 123×10 + 123×2 = 1230 + 246 = 1476' },
    { prompt: '234 × 15 = ?', answer: '3510', expl: '234 × 15 = 234×10 + 234×5 = 2340 + 1170 = 3510' },
    { prompt: '345 × 23 = ?', answer: '7935', expl: '345 × 20 = 6900，345 × 3 = 1035，6900 + 1035 = 7935' },
    { prompt: '456 × 34 = ?', answer: '15504', expl: '456 × 30 = 13680，456 × 4 = 1824，13680 + 1824 = 15504' },
    { prompt: '567 × 45 = ?', answer: '25515', expl: '567 × 45 = 567×40 + 567×5 = 22680 + 2835 = 25515' },
    { prompt: '678 × 56 = ?', answer: '37968', expl: '678 × 56 = 678×50 + 678×6 = 33900 + 4068 = 37968' },
    { prompt: '789 × 67 = ?', answer: '52863', expl: '789 × 67 = 789×60 + 789×7 = 47340 + 5523 = 52863' },
    { prompt: '125 × 32 = ?', answer: '4000', expl: '125 × 32 = 125 × 8 × 4 = 1000 × 4 = 4000' },
    { prompt: '250 × 24 = ?', answer: '6000', expl: '250 × 24 = 250 × 4 × 6 = 1000 × 6 = 6000' },
    { prompt: '101 × 99 = ?', answer: '9999', expl: '101 × 99 = (100+1) × 99 = 9900 + 99 = 9999' },
    { prompt: '312 × 48 = ?', answer: '14976', expl: '312 × 48 = 312×50 - 312×2 = 15600 - 624 = 14976' },
    { prompt: '420 × 63 = ?', answer: '26460', expl: '420 × 63 = 42 × 63 × 10 = 2646 × 10 = 26460' },
  ]
  for (const q of threeByTwoDirect) {
    await prisma.questionTemplate.create({
      data: {
        skillId: threeByTwoMul.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: q.expl,
      },
    })
  }

  // ───────── 兩位數除法（two-digit-div）: 參數化 + 直接題 ─────────
  const twoDigitDivTemplates = [
    { prompt: '{a} ÷ {b} = ?', params: { aMin: 100, aMax: 999, bMin: 11, bMax: 50, aMultipleOfB: true }, expl: '除數是兩位數的除法：先用除數的十位估商，再調整。' },
    { prompt: '{a} ÷ {b} = ?⋯⋯?', params: { aMin: 100, aMax: 999, bMin: 11, bMax: 50, aMultipleOfB: false }, expl: '有餘數的除法：餘數要比除數小。' },
  ]
  for (const t of twoDigitDivTemplates) {
    await prisma.questionTemplate.create({
      data: {
        skillId: twoDigitDiv.id,
        type: 'DIV',
        prompt: t.prompt,
        paramsJson: JSON.stringify(t.params),
        answer: t.params.aMultipleOfB ? '{a/b}' : '{a/b}⋯⋯{a%b}',
        explanation: t.expl,
      },
    })
  }

  const twoDigitDivDirect: { prompt: string; answer: string; expl: string }[] = [
    { prompt: '144 ÷ 12 = ?', answer: '12', expl: '12 × 12 = 144，所以 144 ÷ 12 = 12' },
    { prompt: '156 ÷ 13 = ?', answer: '12', expl: '13 × 12 = 156，所以 156 ÷ 13 = 12' },
    { prompt: '180 ÷ 15 = ?', answer: '12', expl: '15 × 12 = 180，所以 180 ÷ 15 = 12' },
    { prompt: '225 ÷ 15 = ?', answer: '15', expl: '15 × 15 = 225，所以 225 ÷ 15 = 15' },
    { prompt: '288 ÷ 24 = ?', answer: '12', expl: '24 × 12 = 288，所以 288 ÷ 24 = 12' },
    { prompt: '360 ÷ 12 = ?', answer: '30', expl: '12 × 30 = 360，所以 360 ÷ 12 = 30' },
    { prompt: '420 ÷ 14 = ?', answer: '30', expl: '14 × 30 = 420，所以 420 ÷ 14 = 30' },
    { prompt: '504 ÷ 21 = ?', answer: '24', expl: '21 × 24 = 504，所以 504 ÷ 21 = 24' },
    { prompt: '672 ÷ 24 = ?', answer: '28', expl: '24 × 28 = 672，所以 672 ÷ 24 = 28' },
    { prompt: '100 ÷ 11 = ?⋯⋯?', answer: '9⋯⋯1', expl: '11 × 9 = 99，100 - 99 = 1，所以 100 ÷ 11 = 9⋯⋯1' },
    { prompt: '200 ÷ 13 = ?⋯⋯?', answer: '15⋯⋯5', expl: '13 × 15 = 195，200 - 195 = 5，所以 200 ÷ 13 = 15⋯⋯5' },
    { prompt: '350 ÷ 16 = ?⋯⋯?', answer: '21⋯⋯14', expl: '16 × 21 = 336，350 - 336 = 14，所以 350 ÷ 16 = 21⋯⋯14' },
  ]
  for (const q of twoDigitDivDirect) {
    await prisma.questionTemplate.create({
      data: {
        skillId: twoDigitDiv.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: q.expl,
      },
    })
  }

  // ───────── 運算定律（arithmetic-laws）: 20+ 題 ─────────
  const arithDirect: { prompt: string; answer: string; expl: string }[] = [
    // 交換律
    { prompt: '25 + 36 = 36 + ？，？是多少？', answer: '25', expl: '加法交換律：a + b = b + a，所以 25 + 36 = 36 + 25' },
    { prompt: '12 × 8 = 8 × ？，？是多少？', answer: '12', expl: '乘法交換律：a × b = b × a，所以 12 × 8 = 8 × 12' },
    { prompt: '47 + 53 = 53 + ？', answer: '47', expl: '交換律：兩個數相加，交換位置和不會改變' },
    { prompt: '25 × 4 = 4 × ？', answer: '25', expl: '交換律：兩個數相乘，交換位置積不會改變' },
    // 結合律
    { prompt: '(25 + 68) + 32 = 25 + (68 + ？)，？是多少？', answer: '32', expl: '加法結合律：三個數相加，先加前兩個或先加後兩個，和不變' },
    { prompt: '(5 × 27) × 2 = 5 × (27 × ？)，？是多少？', answer: '2', expl: '乘法結合律：三個數相乘，先乘前兩個或先乘後兩個，積不變' },
    { prompt: '16 + 37 + 24 = 16 + 24 + 37 用了什麼運算定律？', answer: '交換律和結合律', expl: '先交換 37 和 24 的位置（交換律），再把 16+24 結合計算（結合律）' },
    { prompt: '25 × 17 × 4 = 25 × 4 × 17 用了什麼運算定律？', answer: '交換律', expl: '把 17 和 4 交換位置，方便先算 25 × 4 = 100' },
    // 分配律
    { prompt: '8 × (25 + 3) = 8 × 25 + 8 × ？', answer: '3', expl: '乘法分配律：a × (b + c) = a × b + a × c' },
    { prompt: '(12 + 8) × 5 = 12 × 5 + 8 × 5 用了什麼運算定律？', answer: '乘法分配律', expl: '乘法分配律可以把括號拆開分別相乘再相加' },
    { prompt: '99 × 36 = (100 - 1) × 36 = 100 × 36 - 1 × 36 = ？', answer: '3564', expl: '利用分配律：99 × 36 = 3600 - 36 = 3564' },
    { prompt: '25 × 44 = 25 × (40 + 4) = 25 × 40 + 25 × 4 = ？', answer: '1100', expl: '利用分配律：25 × 44 = 1000 + 100 = 1100' },
    { prompt: '67 + 45 + 33 = (67 + 33) + 45 = ？', answer: '145', expl: '利用交換律和結合律：67+33=100，100+45=145' },
    { prompt: '125 × 56 = 125 × 8 × 7 = ？', answer: '7000', expl: '利用結合律：125 × 8 = 1000，1000 × 7 = 7000' },
    { prompt: '48 + 39 + 52 + 61 = (48 + 52) + (39 + 61) = ？', answer: '200', expl: '先湊整：48+52=100，39+61=100，100+100=200' },
    { prompt: '101 × 45 = 100 × 45 + 1 × 45 = ？', answer: '4545', expl: '利用分配律：101 × 45 = (100+1) × 45 = 4500 + 45 = 4545' },
    { prompt: '35 × 102 = 35 × 100 + 35 × 2 = ？', answer: '3570', expl: '利用分配律：35 × 102 = 3500 + 70 = 3570' },
    { prompt: '2000 ÷ 125 ÷ 8 = 2000 ÷ (125 × 8) = 2000 ÷ 1000 = ？', answer: '2', expl: '除法的性質：連續除以兩個數等於除以這兩個數的積' },
    { prompt: '540 ÷ 18 = 540 ÷ 9 ÷ 2 = ？', answer: '30', expl: '除法的性質：540 ÷ 9 = 60，60 ÷ 2 = 30' },
  ]
  for (const q of arithDirect) {
    await prisma.questionTemplate.create({
      data: {
        skillId: arithmeticLaws.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: q.expl,
      },
    })
  }

  // ───────── 小數性質與計算（decimal-property）: 20+ 題 ─────────
  const decimalPropDirect: { prompt: string; answer: string; expl: string }[] = [
    { prompt: '0.5 和 0.50 哪個大？', answer: '一樣大', expl: '小數的末尾補 0，大小不變。0.5 = 0.50' },
    { prompt: '3.14 和 3.140 哪個大？', answer: '一樣大', expl: '小數性質：3.14 = 3.140，末尾的 0 不影響大小' },
    { prompt: '0.7 和 0.07 哪個大？', answer: '0.7', expl: '0.7 = 0.70，0.70 > 0.07，所以 0.7 比較大' },
    { prompt: '0.25 和 0.3 哪個大？', answer: '0.3', expl: '0.3 = 0.30，0.30 > 0.25，所以 0.3 比較大' },
    { prompt: '1.23 + 2.45 = ?', answer: '3.68', expl: '小數加法對齊小數點：1.23 + 2.45 = 3.68' },
    { prompt: '5.67 - 2.34 = ?', answer: '3.33', expl: '小數減法對齊小數點：5.67 - 2.34 = 3.33' },
    { prompt: '0.68 + 0.25 = ?', answer: '0.93', expl: '0.68 + 0.25 = 0.93，百分位 8+5=13 進 1' },
    { prompt: '1.05 - 0.37 = ?', answer: '0.68', expl: '1.05 - 0.37 = 0.68，需要退位' },
    { prompt: '3.6 + 2.85 = ?', answer: '6.45', expl: '3.60 + 2.85 = 6.45，注意末尾補 0 對齊' },
    { prompt: '10 - 3.25 = ?', answer: '6.75', expl: '10.00 - 3.25 = 6.75，整數補 .00 再減' },
    { prompt: '0.8 × 10 = ?', answer: '8', expl: '小數乘以 10：小數點向右移一位' },
    { prompt: '3.25 × 100 = ?', answer: '325', expl: '小數乘以 100：小數點向右移兩位' },
    { prompt: '56.7 ÷ 10 = ?', answer: '5.67', expl: '小數除以 10：小數點向左移一位' },
    { prompt: '3.14 精確到十分位（四捨五入）是多少？', answer: '3.1', expl: '百分位是 4 < 5，捨去，所以 3.14 ≈ 3.1' },
    { prompt: '6.85 精確到十分位（四捨五入）是多少？', answer: '6.9', expl: '百分位是 5 ≥ 5，進位，所以 6.85 ≈ 6.9' },
    { prompt: '0.98 精確到個位（四捨五入）是多少？', answer: '1', expl: '十分位是 9 ≥ 5，進位，所以 0.98 ≈ 1' },
    { prompt: '2.5 + 3.7 = ?', answer: '6.2', expl: '2.5 + 3.7 = 6.2，十分位 5+7=12 進 1' },
    { prompt: '4.2 - 1.8 = ?', answer: '2.4', expl: '4.2 - 1.8 = 2.4，需要退位' },
    { prompt: '12.56 + 3.44 = ?', answer: '16', expl: '12.56 + 3.44 = 16.00 = 16，剛好湊整' },
  ]
  for (const q of decimalPropDirect) {
    await prisma.questionTemplate.create({
      data: {
        skillId: decimalProperty.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: q.expl,
      },
    })
  }

  // ───────── 三角形（triangle）: 20+ 題 ─────────
  const triangleDirect: { prompt: string; answer: string; expl: string }[] = [
    { prompt: '三角形的三個內角和是多少度？', answer: '180', expl: '任何三角形的三個內角和都是 180 度' },
    { prompt: '一個三角形，兩個角分別是 70° 和 50°，第三個角是幾度？', answer: '60', expl: '180 - 70 - 50 = 60 度' },
    { prompt: '一個直角三角形，其中一個角是 35°，另一個銳角是幾度？', answer: '55', expl: '直角三角形直角=90°，180 - 90 - 35 = 55 度' },
    { prompt: '等腰三角形的頂角是 80°，每個底角是幾度？', answer: '50', expl: '等腰三角形兩個底角相等，(180 - 80) ÷ 2 = 50 度' },
    { prompt: '等邊三角形的每個角是幾度？', answer: '60', expl: '等邊三角形三個角相等，180 ÷ 3 = 60 度' },
    { prompt: '一個三角形的三個邊長分別是 3、4、5，這是什麼三角形？', answer: '直角三角形', expl: '3² + 4² = 9 + 16 = 25 = 5²，滿足勾股定理，是直角三角形' },
    { prompt: '三角形三邊長 5cm、5cm、8cm，這是什麼三角形？', answer: '等腰三角形', expl: '有兩邊相等（5cm = 5cm），是等腰三角形' },
    { prompt: '三角形的高是 6cm，底是 8cm，面積是多少？', answer: '24', expl: '三角形面積 = 底 × 高 ÷ 2 = 8 × 6 ÷ 2 = 24 平方公分' },
    { prompt: '一個三角形的底是 10cm，面積是 40cm²，高是多少？', answer: '8', expl: '高 = 面積 × 2 ÷ 底 = 40 × 2 ÷ 10 = 8 公分' },
    { prompt: '一個三角形的面積是 30cm²，高是 6cm，底是多少？', answer: '10', expl: '底 = 面積 × 2 ÷ 高 = 30 × 2 ÷ 6 = 10 公分' },
    { prompt: '三角形三邊長 3cm、4cm、7cm，能否構成三角形？', answer: '不能', expl: '3 + 4 = 7，兩邊之和大於第三邊才可構成三角形，這裡等於所以不行' },
    { prompt: '三角形三邊長 5cm、6cm、10cm，能否構成三角形？', answer: '能', expl: '5 + 6 = 11 > 10，兩邊之和大於第三邊，可以構成三角形' },
    { prompt: '直角三角形的一個銳角是 28°，另一個銳角是幾度？', answer: '62', expl: '180 - 90 - 28 = 62 度' },
    { prompt: '等腰直角三角形的每個角是幾度？', answer: '90,45,45', expl: '等腰直角三角形：直角=90°，兩個銳角=(180-90)÷2=45°' },
    { prompt: '平行四邊形的面積是 48cm²，和它等底等高的三角形面積是多少？', answer: '24', expl: '等底等高的三角形面積是平行四邊形的一半：48 ÷ 2 = 24cm²' },
    { prompt: '鈍角三角形會有幾個鈍角？', answer: '1個', expl: '三角形最多只有一個鈍角（>90°），否則內角和會超過 180°' },
    { prompt: '銳角三角形的三個角都是什麼角？', answer: '銳角', expl: '銳角三角形的三個角都小於 90°，都是銳角' },
  ]
  for (const q of triangleDirect) {
    await prisma.questionTemplate.create({
      data: {
        skillId: triangle.id,
        type: 'DIRECT',
        prompt: q.prompt,
        answer: q.answer,
        explanation: q.expl,
      },
    })
  }

  // ============ 題目分類標記（為 G3/G4 題目設定 category）============
  const categoryMapping: Record<string, string> = {
    'three-digit-add-sub': 'WITHIN_10000',
    'intro-fraction': 'FRACTION',
    'fraction-compare': 'FRACTION',
    'area-perimeter': 'PERIMETER_AREA',
    'large-multiply': 'MULTI_DIGIT_MUL',
    'decimal-intro': 'DECIMAL',
    'long-division': 'ONE_DIGIT_DIV',
    // 四年級新增
    'large-numbers': 'LARGE_NUMBERS',
    'three-by-two-mul': 'THREE_BY_TWO_MUL',
    'two-digit-div': 'TWO_DIGIT_DIV',
    'arithmetic-laws': 'ARITHMETIC_LAWS',
    'decimal-property': 'DECIMAL_PROPERTY',
    'triangle': 'TRIANGLE',
  }
  for (const [skillCode, category] of Object.entries(categoryMapping)) {
    const skill = await prisma.skill.findUnique({ where: { code: skillCode } })
    if (skill) {
      await prisma.questionTemplate.updateMany({
        where: { skillId: skill.id, category: 'GENERAL' },
        data: { category: category as any },
      })
    }
  }
  console.log('  ✓ Question categories assigned')

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
  ]

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { code: badge.code },
      update: { name: badge.name, icon: badge.icon, condition: badge.condition },
      create: badge,
    })
  }

  console.log(`  ✓ Badges: ${badges.length} seeded`)
  console.log('  ✓ Skills: 25 (K-4), Questions seeded')
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
