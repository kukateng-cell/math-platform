// 題目生成：處理參數化模板（ADD/SUB）與直接題目
// 回傳 { prompt, answer, options? } 的具體題目實例

export type QuestionInstance = {
  prompt: string
  answer: string
  options?: string[]
  templateId?: string
  // 參數化題目用：實際抽到的運算元（供伺服器驗證重算）
  _a?: number
  _b?: number
}

type RawTemplate = {
  id?: string
  type: 'DIRECT' | 'ADD' | 'SUB' | 'WORD_PROBLEM' | 'MUL' | 'DIV'
  prompt: string
  paramsJson: string | null
  answer: string
  options: string | null
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 根據模板產生一個具體題目實例
export function generateQuestion(template: RawTemplate): QuestionInstance {
  if (template.type === 'DIRECT') {
    const options = template.options
      ? shuffle(template.options.split(',').map((s) => s.trim()))
      : undefined
    return { prompt: template.prompt, answer: template.answer, options, templateId: template.id }
  }

  // 參數化題目
  const params = template.paramsJson ? safeParse(template.paramsJson) : {}
  const aMin = Number(params.aMin ?? 1)
  const aMax = Number(params.aMax ?? 5)
  const bMin = Number(params.bMin ?? 1)
  const bMax = Number(params.bMax ?? 5)

  let a = randInt(aMin, aMax)
  let b = randInt(bMin, bMax)

  if (template.type === 'ADD') {
    // 加法：保證和不超過 sumMax。若參數本身就矛盾（aMin+bMin>sumMax）則降級處理
    const sumMax = Number(params.sumMax ?? aMax + bMax)
    let tries = 0
    while (a + b > sumMax && tries < 20) {
      // 嘗試把 b 縮到合法且不超過 sumMax 的範圍
      const bCeiling = Math.max(bMin, Math.min(bMax, sumMax - a))
      b = randInt(bMin, bCeiling)
      // 若仍超，連帶縮 a
      if (a + b > sumMax) {
        const aCeiling = Math.max(aMin, Math.min(aMax, sumMax - b))
        a = randInt(aMin, aCeiling)
      }
      tries++
    }
  } else if (template.type === 'SUB') {
    // 減法：確保 a >= b（差不為負），在合法範圍內重抽而非強制交換
    let tries = 0
    while (a < b && tries < 20) {
      a = randInt(Math.max(aMin, bMin), aMax)
      b = randInt(bMin, Math.min(bMax, a))
      tries++
    }
    // 保險：重抽失敗就直接令 a = max(a,b)
    if (a < b) [a, b] = [Math.max(a, b), Math.min(a, b)]
  } else if (template.type === 'WORD_PROBLEM') {
    // 文字題：內部根據 operation 決定運算邏輯
    const operation: 'add' | 'sub' | 'mul' | 'div' =
      params.operation === 'sub' ? 'sub' :
      params.operation === 'mul' ? 'mul' :
      params.operation === 'div' ? 'div' : 'add'
    const wpSumMax = Number(params.sumMax ?? (operation === 'add' ? aMax + bMax : aMax))

    let tries = 0
    let answer: number

    if (operation === 'add') {
      while (a + b > wpSumMax && tries < 20) {
        const bCeiling = Math.max(bMin, Math.min(bMax, wpSumMax - a))
        b = randInt(bMin, bCeiling)
        if (a + b > wpSumMax) {
          const aCeiling = Math.max(aMin, Math.min(aMax, wpSumMax - b))
          a = randInt(aMin, aCeiling)
        }
        tries++
      }
      answer = a + b
    } else if (operation === 'sub') {
      while (a < b && tries < 20) {
        a = randInt(Math.max(aMin, bMin), aMax)
        b = randInt(bMin, Math.min(bMax, a))
        tries++
      }
      if (a < b) [a, b] = [Math.max(a, b), Math.min(a, b)]
      answer = a - b
    } else if (operation === 'mul') {
      answer = a * b
    } else {
      // operation === 'div'：確保整除
      // 先生成 b，再從合法商範圍選 q，計算 a = b × q
      while (tries < 30) {
        b = randInt(bMin, bMax)
        const qMin = Math.max(1, Math.ceil(aMin / b))
        const qMax = Math.floor(aMax / b)
        if (qMin <= qMax) {
          const q = randInt(qMin, qMax)
          a = b * q
          break
        }
        tries++
      }
      // 保險：若仍無合法組合，用最簡單的修正
      if (a % b !== 0) {
        const q = Math.max(1, Math.round(a / b))
        a = b * q
      }
      answer = a / b
    }

    const prompt = template.prompt.replace('{a}', String(a)).replace('{b}', String(b))

    const distractors = generateDistractors(answer, 3)
    const options = shuffle([answer, ...distractors]).map(String)

    return { prompt, answer: String(answer), options, templateId: template.id, _a: a, _b: b }
  } else if (template.type === 'MUL') {
    // 乘法：a × b，一般 aMin/aMax 控制乘數範圍、bMin/bMax 控制被乘數範圍
    // 答案 = a × b
    const answer = a * b

    const prompt = template.prompt
      .replace('{a}', String(a))
      .replace('{b}', String(b))

    // 干擾項：answer ± a, answer ± b, answer ± (a+b) 等
    const distractors = generateMulDistractors(answer, a, b, 3)
    const options = shuffle([answer, ...distractors]).map(String)

    return { prompt, answer: String(answer), options, templateId: template.id, _a: a, _b: b }
  } else if (template.type === 'DIV') {
    // 除法：a ÷ b，需保證整除
    const aMultipleOfB = params.aMultipleOfB === true
    let tries = 0

    if (aMultipleOfB) {
      // 先生成 b，再從合法商範圍選商 q，計算 a = b × q，確保整除且在範圍內
      b = randInt(bMin, bMax)
      const qMin = Math.max(1, Math.ceil(aMin / b))
      const qMax = Math.floor(aMax / b)
      if (qMin <= qMax) {
        const q = randInt(qMin, qMax)
        a = b * q
      } else {
        // 沒有合法商：嘗試其他 b 值
        while ((qMin > qMax) && tries < 30) {
          b = randInt(bMin, bMax)
          const newQMin = Math.max(1, Math.ceil(aMin / b))
          const newQMax = Math.floor(aMax / b)
          if (newQMin <= newQMax) {
            const q = randInt(newQMin, newQMax)
            a = b * q
            break
          }
          tries++
        }
      }
    } else {
      // 單純隨機 a, b，若不整除則重新選
      while (a % b !== 0 && tries < 30) {
        b = randInt(bMin, Math.min(bMax, a))
        if (a % b !== 0) {
          a = randInt(aMin, aMax)
        }
        tries++
      }
      // 保險：找最接近 a 且能被 b 整除的數
      if (a % b !== 0) {
        const q = Math.max(1, Math.round(a / b))
        a = b * q
      }
    }

    const answer = a / b

    const prompt = template.prompt
      .replace('{a}', String(a))
      .replace('{b}', String(b))

    // 干擾項：answer ± 1, answer ± b, answer ± 2 等
    const distractors = generateDivDistractors(answer, b, 3)
    const options = shuffle([answer, ...distractors]).map(String)

    return { prompt, answer: String(answer), options, templateId: template.id, _a: a, _b: b }
  }

  const answer = template.type === 'ADD' ? a + b : a - b

  const prompt = template.prompt.replace('{a}', String(a)).replace('{b}', String(b))

  // 產生選項：正確答案 + 干擾項，避免無限迴圈
  const distractors = generateDistractors(answer, 3)
  const options = shuffle([answer, ...distractors]).map(String)

  return { prompt, answer: String(answer), options, templateId: template.id, _a: a, _b: b }
}

// 安全 JSON parse
function safeParse(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json)
  } catch {
    return {}
  }
}

// 產生不重複的干擾項（保證收斂）
function generateDistractors(answer: number, count: number): number[] {
  const result = new Set<number>()
  const spread = Math.max(3, Math.ceil(answer * 0.5) + 2)
  let tries = 0
  while (result.size < count && tries < 50) {
    // 在 answer 附近隨機取，含小幅度與大幅度
    const delta = randInt(-spread, spread)
    const d = answer + delta
    if (d >= 0 && d !== answer) result.add(d)
    tries++
  }
  // 補不夠的：用 answer±1, ±2 補到滿
  let offset = 1
  while (result.size < count) {
    const cands = [answer + offset, answer - offset].filter((x) => x >= 0 && x !== answer && !result.has(x))
    for (const c of cands) {
      if (result.size < count) result.add(c)
    }
    offset++
    if (offset > 20) break
  }
  return [...result]
}

// 乘法專用干擾項：答案附近 + 乘數加減產生的值
function generateMulDistractors(answer: number, a: number, b: number, count: number): number[] {
  const result = new Set<number>()
  // 常見錯誤干擾項
  const candidates = [
    answer + a,
    answer - a,
    answer + b,
    answer - b,
    answer + a + b,
    answer - a - b,
    (a + 1) * b,
    a * (b + 1),
    (a - 1) * b,
    a * (b - 1),
  ]
  for (const c of candidates) {
    if (c > 0 && c !== answer) result.add(c)
  }
  // 如果不夠，從附近補（保證收斂）
  let offset = 1
  while (result.size < count && offset < 100) {
    if (answer + offset > 0 && answer + offset !== answer) result.add(answer + offset)
    if (answer - offset > 0 && answer - offset !== answer) result.add(answer - offset)
    offset++
  }
  return shuffle([...result]).slice(0, count)
}

// 除法專用干擾項：商附近 + 除數加減產生的值
function generateDivDistractors(answer: number, b: number, count: number): number[] {
  const result = new Set<number>()
  const candidates = [
    answer + 1,
    answer - 1,
    answer + 2,
    answer - 2,
    answer + b,
    answer - b,
    answer * b,
    Math.floor(answer / 2),
    answer * 2,
  ]
  for (const c of candidates) {
    if (c > 0 && c !== answer) result.add(c)
  }
  // 保證收斂：從附近補到滿
  let offset = 1
  while (result.size < count && offset < 100) {
    if (answer + offset > 0 && answer + offset !== answer) result.add(answer + offset)
    if (answer - offset > 0 && answer - offset !== answer) result.add(answer - offset)
    offset++
  }
  return shuffle([...result]).slice(0, count)
}
