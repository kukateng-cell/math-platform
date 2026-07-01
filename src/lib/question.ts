// 題目生成：處理參數化模板（ADD/SUB）與直接題目
// 回傳 { prompt, answer, options? } 的具體題目實例

export type QuestionInstance = {
  prompt: string
  answer: string
  options?: string[]
  templateId?: string
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
  const params = template.paramsJson ? JSON.parse(template.paramsJson) : {}
  let a = randInt(params.aMin ?? 1, params.aMax ?? 5)
  let b = randInt(params.bMin ?? 1, params.bMax ?? 5)

  // 加法：保證和不超過 sumMax；減法：保證差 ≥ 0
  if (template.type === 'ADD' && params.sumMax && a + b > params.sumMax) {
    b = Math.max(params.bMin ?? 1, params.sumMax - a)
    if (a + b > params.sumMax) {
      a = Math.max(params.aMin ?? 1, params.sumMax - b)
    }
  }
  if (template.type === 'SUB' && b > a) {
    ;[a, b] = [b, a] // 確保被減數 ≥ 減數，差不為負
  }

  const answer = template.type === 'ADD' ? a + b : a - b

  const prompt = template.prompt.replace('{a}', String(a)).replace('{b}', String(b))
  // 產生選項：把正確答案與幾個干擾項混在一起
  const distractors = new Set<number>()
  while (distractors.size < 3) {
    const d = answer + randInt(-2, 2)
    if (d >= 0 && d !== answer) distractors.add(d)
  }
  const options = shuffle([answer, ...distractors]).map(String)

  return { prompt, answer: String(answer), options, templateId: template.id }
}
