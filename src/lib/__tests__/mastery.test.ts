import { describe, it, expect } from 'vitest'
import { getRecommendation, type Recommendation } from '../mastery'

// ============ getRecommendation 單元測試 ============
// P2-11：推薦系統改成明確狀態機，逐一驗證以下情境：
//   1. 未開始          → START_FIRST
//   2. 低正確率回前置  → PRACTICE_PREREQ
//   3. 保持當前        → KEEP
//   4. 掌握後晉級      → ADVANCE
//   5. 分支技能選擇    → ADVANCE（選 order 最前者，非任意）
//   6. 全部完成        → ALL_DONE

// ---- 測試資料 ----
// 線性鏈：count → compare → add（後者以前者為前置）
type SkillInput = { id: string; prerequisiteId: string | null; name?: string }
const linearSkills: SkillInput[] = [
  { id: 'count', prerequisiteId: null, name: '數數' },
  { id: 'compare', prerequisiteId: 'count', name: '數量比較' },
  { id: 'add', prerequisiteId: 'compare', name: '加法' },
]

// 分支：count 同時是 compare 與 shape 的前置（多個 dependent）
const branchSkills: SkillInput[] = [
  { id: 'count', prerequisiteId: null, name: '數數' },
  { id: 'compare', prerequisiteId: 'count', name: '數量比較' },
  { id: 'shape', prerequisiteId: 'count', name: '圖形辨認' },
]

// mastery 快照輔助建構
type MasteryInput = {
  skillId: string
  recentCorrect: number
  recentTotal: number
  masteryLevel: number
}
const m = (
  skillId: string,
  recentCorrect: number,
  recentTotal: number
): MasteryInput => ({
  skillId,
  recentCorrect,
  recentTotal,
  masteryLevel: recentTotal > 0 ? recentCorrect / recentTotal : 0,
})

describe('getRecommendation — 未開始', () => {
  it('無任何練習紀錄 → START_FIRST 指向第一個技能', () => {
    const rec = getRecommendation(linearSkills, [])
    expect(rec.type).toBe('START_FIRST')
    expect(rec.skillId).toBe('count')
  })

  it('無任何技能 → START_FIRST（無 skillId）', () => {
    const rec = getRecommendation([], [])
    expect(rec.type).toBe('START_FIRST')
    expect(rec.skillId).toBeUndefined()
  })

  it('有 mastery 紀錄但全部 recentTotal=0 → 仍視為未開始', () => {
    // 只有空紀錄、尚未實際作答
    const rec = getRecommendation(linearSkills, [m('count', 0, 0)])
    expect(rec.type).toBe('START_FIRST')
    expect(rec.skillId).toBe('count')
  })
})

describe('getRecommendation — 全部完成', () => {
  it('所有技能皆已掌握 → ALL_DONE', () => {
    const rec = getRecommendation(linearSkills, [
      m('count', 5, 5),
      m('compare', 5, 5),
      m('add', 5, 5),
    ])
    expect(rec.type).toBe('ALL_DONE')
    expect(rec.skillId).toBeUndefined()
  })

  it('單一技能且已掌握 → ALL_DONE', () => {
    const rec = getRecommendation(
      [{ id: 'only', prerequisiteId: null, name: '唯一' }],
      [m('only', 5, 5)]
    )
    expect(rec.type).toBe('ALL_DONE')
  })
})

describe('getRecommendation — 掌握後晉級 (ADVANCE)', () => {
  it('前置已掌握、下一個未練習 → ADVANCE', () => {
    const rec = getRecommendation(linearSkills, [m('count', 5, 5)])
    expect(rec.type).toBe('ADVANCE')
    expect(rec.skillId).toBe('compare')
  })

  it('多個前置已掌握、下一個未練習 → ADVANCE 到序列中第一個未練習者', () => {
    // count、compare 都掌握，add 未練
    const rec = getRecommendation(linearSkills, [
      m('count', 5, 5),
      m('compare', 5, 5),
    ])
    expect(rec.type).toBe('ADVANCE')
    expect(rec.skillId).toBe('add')
  })

  it('前一個技能掌握邊界值（剛好 5/5, 95% 門檻）→ ADVANCE', () => {
    // 5/5 = 100% >= 95% 且樣本 = 5 >= 5 → 掌握
    const rec = getRecommendation(linearSkills, [m('count', 5, 5)])
    expect(rec.type).toBe('ADVANCE')
  })
})

describe('getRecommendation — 分支技能選擇', () => {
  it('count 掌握後，compare 與 shape 皆依賴 count → ADVANCE 到順序在前者', () => {
    // compare（序列 index 1）排在 shape（index 2）前面
    const rec = getRecommendation(branchSkills, [m('count', 5, 5)])
    expect(rec.type).toBe('ADVANCE')
    expect(rec.skillId).toBe('compare')
    expect(rec.skillId).not.toBe('shape')
  })

  it('compare 已掌握、shape 未練 → ADVANCE 到 shape', () => {
    const rec = getRecommendation(branchSkills, [
      m('count', 5, 5),
      m('compare', 5, 5),
    ])
    expect(rec.type).toBe('ADVANCE')
    expect(rec.skillId).toBe('shape')
  })
})

describe('getRecommendation — 低正確率回前置 (PRACTICE_PREREQ)', () => {
  it('正確率 < 40%（樣本足夠）且有前置 → PRACTICE_PREREQ', () => {
    // count 掌握；compare 練 5 題對 1 題（20% < 40%）
    const rec = getRecommendation(linearSkills, [
      m('count', 5, 5),
      m('compare', 1, 5),
    ])
    expect(rec.type).toBe('PRACTICE_PREREQ')
    expect(rec.skillId).toBe('count')
  })

  it('正確率低但樣本不足（< 5）→ 不回前置，保持當前', () => {
    // compare 只練 3 題對 0 題，樣本不足 → KEEP
    const rec = getRecommendation(linearSkills, [
      m('count', 5, 5),
      m('compare', 0, 3),
    ])
    expect(rec.type).toBe('KEEP')
    expect(rec.skillId).toBe('compare')
  })

  it('正確率低但無前置技能（序列首項）→ 不回前置，保持當前', () => {
    // count 是首項，無 prerequisite；即使表現差也無處可退
    const rec = getRecommendation(linearSkills, [m('count', 1, 5)])
    expect(rec.type).toBe('KEEP')
    expect(rec.skillId).toBe('count')
  })
})

describe('getRecommendation — 保持當前 (KEEP)', () => {
  it('正確率中等（40% ~ 95%）→ KEEP', () => {
    const rec = getRecommendation(linearSkills, [
      m('count', 5, 5),
      m('compare', 3, 5), // 60%
    ])
    expect(rec.type).toBe('KEEP')
    expect(rec.skillId).toBe('compare')
  })

  it('高正確率但樣本不足（< 5）→ 未達掌握，保持當前', () => {
    // compare 4/4 = 100%，但樣本只有 4 < 5 → 不算掌握 → KEEP
    const rec = getRecommendation(linearSkills, [
      m('count', 5, 5),
      m('compare', 4, 4),
    ])
    expect(rec.type).toBe('KEEP')
    expect(rec.skillId).toBe('compare')
  })

  it('rate 剛好 40% 邊界 → KEEP（不觸發 < 40% 回前置）', () => {
    // 2/5 = 40%，不 < 40% → KEEP
    const rec = getRecommendation(linearSkills, [
      m('count', 5, 5),
      m('compare', 2, 5),
    ])
    expect(rec.type).toBe('KEEP')
    expect(rec.skillId).toBe('compare')
  })
})

describe('getRecommendation — 狀態機窮舉', () => {
  // 確認所有可能 type 都能被觸發，沒有死分支
  const allTypes: Recommendation['type'][] = [
    'START_FIRST',
    'ALL_DONE',
    'ADVANCE',
    'PRACTICE_PREREQ',
    'KEEP',
  ]

  it('五種狀態皆可到達', () => {
    const seen = new Set<Recommendation['type']>()
    const cases: Recommendation[] = [
      getRecommendation(linearSkills, []), // START_FIRST
      getRecommendation(linearSkills, [m('count', 5, 5), m('compare', 5, 5), m('add', 5, 5)]), // ALL_DONE
      getRecommendation(linearSkills, [m('count', 5, 5)]), // ADVANCE
      getRecommendation(linearSkills, [m('count', 5, 5), m('compare', 1, 5)]), // PRACTICE_PREREQ
      getRecommendation(linearSkills, [m('count', 5, 5), m('compare', 3, 5)]), // KEEP
    ]
    for (const rec of cases) seen.add(rec.type)
    for (const t of allTypes) {
      expect(seen.has(t)).toBe(true)
    }
  })
})
