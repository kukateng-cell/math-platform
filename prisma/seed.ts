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

  const mixedOps = await prisma.skill.upsert({
    where: { code: 'mixed-operations' },
    update: { order: 15, prerequisiteId: divideAdvanced.id },
    create: {
      code: 'mixed-operations',
      name: '四則混合',
      description: '加減乘除混合運算，先乘除後加減',
      gradeLevel: 'G3',
      order: 15,
      prerequisiteId: divideAdvanced.id,
    },
  })

  const fractionIntro = await prisma.skill.upsert({
    where: { code: 'fraction-intro' },
    update: { order: 16, prerequisiteId: mixedOps.id },
    create: {
      code: 'fraction-intro',
      name: '分數初步',
      description: '認識分數、真分數、帶分數與簡單分數比較',
      gradeLevel: 'G3',
      order: 16,
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
      name: '分數加減法',
      description: '異分母分數加減、通分與約分',
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

  const fractionMulDiv = await prisma.skill.upsert({
    where: { code: 'fraction-multiply-divide' },
    update: { order: 24, prerequisiteId: fractionOps.id },
    create: {
      code: 'fraction-multiply-divide',
      name: '分數乘除法',
      description: '分數乘以分數、分數除以分數的計算',
      gradeLevel: 'G5',
      order: 24,
      prerequisiteId: fractionOps.id,
    },
  })

  const volumeIntro = await prisma.skill.upsert({
    where: { code: 'volume-intro' },
    update: { order: 25 },
    create: {
      code: 'volume-intro',
      name: '體積',
      description: '長方體和正方體的體積公式與應用',
      gradeLevel: 'G5',
      order: 25,
    },
  })

  // ============ G6 比例、百分比與幾何 ============
  const ratio = await prisma.skill.upsert({
    where: { code: 'ratio' },
    update: { order: 26, prerequisiteId: fractionMulDiv.id },
    create: {
      code: 'ratio',
      name: '比與比例',
      description: '比的意義、化簡比、比例式的應用',
      gradeLevel: 'G6',
      order: 26,
      prerequisiteId: fractionMulDiv.id,
    },
  })

  const percent = await prisma.skill.upsert({
    where: { code: 'percent' },
    update: { order: 27, prerequisiteId: ratio.id },
    create: {
      code: 'percent',
      name: '百分比',
      description: '百分率、百分比的計算、折扣與加成',
      gradeLevel: 'G6',
      order: 27,
      prerequisiteId: ratio.id,
    },
  })

  const circle = await prisma.skill.upsert({
    where: { code: 'circle' },
    update: { order: 28 },
    create: {
      code: 'circle',
      name: '圓',
      description: '圓周率、圓周長與圓面積的計算',
      gradeLevel: 'G6',
      order: 28,
    },
  })

  const speed = await prisma.skill.upsert({
    where: { code: 'speed' },
    update: { order: 29, prerequisiteId: ratio.id },
    create: {
      code: 'speed',
      name: '速率',
      description: '速度、距離、時間的關係與計算',
      gradeLevel: 'G6',
      order: 29,
      prerequisiteId: ratio.id,
    },
  })

  const prismVolume = await prisma.skill.upsert({
    where: { code: 'prism-volume' },
    update: { order: 30, prerequisiteId: volumeIntro.id },
    create: {
      code: 'prism-volume',
      name: '柱體體積',
      description: '圓柱與角柱的體積計算',
      gradeLevel: 'G6',
      order: 30,
      prerequisiteId: volumeIntro.id,
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
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: volumeIntro.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: '體積=長×寬×高，表面積=6×邊長²' },
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
  ]) {
    await prisma.questionTemplate.create({
      data: { skillId: circle.id, type: 'DIRECT', prompt: q.prompt, answer: q.answer, explanation: '圓周長=2πr=πd，圓面積=πr²' },
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

  // 更新成功訊息
  const totalQ = await prisma.questionTemplate.count()
  console.log(`  ✓ Badges: ${badges.length} seeded`)
  console.log(`  ✓ Skills from K to G6, Questions: ${totalQ}`)
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
