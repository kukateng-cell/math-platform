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
  type: 'DIRECT' | 'ADD' | 'SUB'
  prompt: string
  paramsJson: string | null
  answer: string
  options: string | null
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffle<T>(arr: T[]): T[] {
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
    const options = template.options ? template.options.split(',').map((s) => s.trim()) : undefined
    return { prompt: template.prompt, answer: template.answer, options, templateId: template.id }
  }

  // 參數化題目
  const params = template.paramsJson ? safeParse(params, template.paramsJson) : {}
  const aMin = params.aMin ?? 1
  const aMax = params.aMax ?? 5
  const bMin = params.bMin ?? 1
  const bMax = params.bMax ?? 5

  let a = randInt(aMin, aMax)
  let b = randInt(bMin, bMax)

  if (template.type === 'ADD') {
    // 加法：保證和不超過 sumMax。若參數本身就矛盾（aMin+bMin>sumMax）則降級處理
    const sumMax = params.sumMax ?? aMax + bMax
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
  }

  const answer = template.type === 'ADD' ? a + b : a - b

  const prompt = template.prompt.replace('{a}', String(a)).replace('{b}', String(b))

  // 產生選項：正確答案 + 干擾項，避免無限迴圈
  const distractors = generateDistractors(answer, 3)
  const options = shuffle([answer, ...distractors]).map(String)

  return { prompt, answer: String(answer), options, templateId: template.id, _a: a, _b: b }
}

// 安全 JSON parse
function safeParse(_placeholder: unknown, json: string): Record<string, number> {
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
