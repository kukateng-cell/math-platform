import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import path from 'node:path'
import bcrypt from 'bcryptjs'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` })
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

  // ============ 題目模板 ============
  // 先刪除作答紀錄與練習（外鍵約束）
  await prisma.attempt.deleteMany({})
  await prisma.practiceSession.deleteMany({})
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

  // ───────── 互動模式題目 ─────────
  // 數字線題目（數數技能）— 提示文字包含實際符號讓孩子數
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

  // 填答鍵盤題目（10 以內加法技能）
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

  console.log(`  ✓ Badges: ${badges.length} seeded`)
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
