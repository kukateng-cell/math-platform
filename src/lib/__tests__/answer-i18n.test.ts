import { describe, it, expect } from 'vitest'
import { normalizeAnswer, isAnswerCorrect, displayAnswer } from '../answer-i18n'

// ============ answer-i18n.ts 單元測試 ============
// 答案等價比對直接影響作答計分正確性，這裡針對中英文時間單位、
// 全形字元、分數、純數字正規化等場景做覆蓋。

describe('純數字答案', () => {
  it('前導零正規化（07 → 7）', () => {
    expect(normalizeAnswer('07')).toBe('7')
  })

  it('小數尾零去除（3.50 → 3.5）', () => {
    expect(normalizeAnswer('3.50')).toBe('3.5')
  })

  it('整數小數（3.0 → 3）', () => {
    expect(normalizeAnswer('3.0')).toBe('3')
  })

  it('負零歸零', () => {
    expect(normalizeAnswer('-0')).toBe('0')
  })
})

describe('分數答案（轉小數比對）', () => {
  it('1/2 = 0.5', () => {
    expect(normalizeAnswer('1/2')).toBe('0.5')
  })

  it('2/4 約分後等於 1/2', () => {
    expect(isAnswerCorrect('2/4', '1/2')).toBe(true)
  })

  it('5/4 = 1.25', () => {
    expect(normalizeAnswer('5/4')).toBe('1.25')
  })
})

describe('全形字元', () => {
  it('全形數字轉半形（１２３ → 123）', () => {
    expect(normalizeAnswer('１２３')).toBe('123')
  })

  it('全形小數點轉半形（３．５ → 3.5）', () => {
    expect(normalizeAnswer('３．５')).toBe('3.5')
  })
})

describe('時間單位中英文等價', () => {
  it('複合：中文「1小時45分」= 規範形「1h45m」', () => {
    expect(normalizeAnswer('1小時45分')).toBe('1h45m')
  })

  it('複合：英文「1 hour 45 minutes」=「1h45m」', () => {
    expect(normalizeAnswer('1 hour 45 minutes')).toBe('1h45m')
  })

  it('HH:MM 格式「4:45」=「4h45m」', () => {
    expect(normalizeAnswer('4:45')).toBe('4h45m')
  })

  it('中英文時間答案視為相等', () => {
    expect(isAnswerCorrect('1小時45分', '1h45m')).toBe(true)
    expect(isAnswerCorrect('2 hours 30 minutes', '2小時30分')).toBe(true)
  })

  it('單一小時「2小時」=「2h」', () => {
    expect(normalizeAnswer('2小時')).toBe('2h')
  })
})

describe('同義詞等價', () => {
  it('等邊三角形 = 正三角形', () => {
    expect(isAnswerCorrect('等邊三角形', '正三角形')).toBe(true)
  })

  it('矩形 = 長方形', () => {
    expect(isAnswerCorrect('矩形', '長方形')).toBe(true)
  })

  it('左邊 = 左側', () => {
    expect(isAnswerCorrect('左側', '左邊')).toBe(true)
  })
})

describe('displayAnswer', () => {
  it('時間答案附加規範形', () => {
    expect(displayAnswer('1小時45分')).toBe('1小時45分 (1h45m)')
  })

  it('非時間答案原樣回傳', () => {
    expect(displayAnswer('正三角形')).toBe('正三角形')
  })
})
