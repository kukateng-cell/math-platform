import { describe, it, expect } from 'vitest'
import { SignupFormSchema, LoginFormSchema, QuestionParamsSchema, EmailSchema } from '../definitions'

// ============ definitions.ts 單元測試 ============
// P1-12：驗證 Email 正規化、表單驗證、題目參數驗證

describe('EmailSchema', () => {
  it('trim 前後空白', () => {
    const result = EmailSchema.parse('  user@example.com  ')
    expect(result).toBe('user@example.com')
  })

  it('轉小寫', () => {
    const result = EmailSchema.parse('User@Example.Com')
    expect(result).toBe('user@example.com')
  })

  it('全小寫保持不變', () => {
    const result = EmailSchema.parse('user@example.com')
    expect(result).toBe('user@example.com')
  })

  it('無效 email 拋錯', () => {
    expect(() => EmailSchema.parse('not-an-email')).toThrow()
  })
})

describe('SignupFormSchema（Email 正規化）', () => {
  it('email 自動轉小寫', () => {
    const result = SignupFormSchema.parse({
      name: '測試',
      email: 'TEST@Example.Com',
      password: 'Password1',
    })
    expect(result.email).toBe('test@example.com')
  })

  it('密碼必須至少 8 碼', () => {
    const result = SignupFormSchema.safeParse({
      name: '測試',
      email: 'test@example.com',
      password: 'Short1',
    })
    expect(result.success).toBe(false)
  })

  it('密碼須含字母', () => {
    const result = SignupFormSchema.safeParse({
      name: '測試',
      email: 'test@example.com',
      password: '12345678',
    })
    expect(result.success).toBe(false)
  })

  it('密碼須含數字', () => {
    const result = SignupFormSchema.safeParse({
      name: '測試',
      email: 'test@example.com',
      password: 'abcdefgh',
    })
    expect(result.success).toBe(false)
  })
})

describe('LoginFormSchema（Email 正規化）', () => {
  it('email 自動轉小寫', () => {
    const result = LoginFormSchema.parse({
      email: 'USER@EXAMPLE.COM',
      password: 'password',
    })
    expect(result.email).toBe('user@example.com')
  })
})

describe('QuestionParamsSchema（P1-8 discriminated union）', () => {
  it('ADD 參數驗證通過', () => {
    const result = QuestionParamsSchema.safeParse({
      type: 'ADD',
      aMin: 1,
      aMax: 5,
      bMin: 1,
      bMax: 5,
      sumMax: 10,
    })
    expect(result.success).toBe(true)
  })

  it('ADD aMin > aMax 應失敗', () => {
    const result = QuestionParamsSchema.safeParse({
      type: 'ADD',
      aMin: 10,
      aMax: 5,
      bMin: 1,
      bMax: 5,
    })
    expect(result.success).toBe(false)
  })

  it('DIV bMin=0 應失敗（除數不可為 0）', () => {
    const result = QuestionParamsSchema.safeParse({
      type: 'DIV',
      aMin: 1,
      aMax: 10,
      bMin: 0,
      bMax: 5,
    })
    expect(result.success).toBe(false)
  })

  it('DIV bMax=0 應失敗（除數不可為 0）', () => {
    const result = QuestionParamsSchema.safeParse({
      type: 'DIV',
      aMin: 1,
      aMax: 10,
      bMin: 0,
      bMax: 0,
    })
    expect(result.success).toBe(false)
  })

  it('WORD_PROBLEM div 操作 bMin=0 應失敗', () => {
    const result = QuestionParamsSchema.safeParse({
      type: 'WORD_PROBLEM',
      aMin: 1,
      aMax: 10,
      bMin: 0,
      bMax: 5,
      operation: 'div',
    })
    expect(result.success).toBe(false)
  })

  it('SUB 參數驗證通過', () => {
    const result = QuestionParamsSchema.safeParse({
      type: 'SUB',
      aMin: 1,
      aMax: 5,
      bMin: 1,
      bMax: 5,
    })
    expect(result.success).toBe(true)
  })

  it('MUL 參數驗證通過', () => {
    const result = QuestionParamsSchema.safeParse({
      type: 'MUL',
      aMin: 1,
      aMax: 9,
      bMin: 1,
      bMax: 9,
    })
    expect(result.success).toBe(true)
  })

  it('rangeMin >= rangeMax 應失敗', () => {
    const result = QuestionParamsSchema.safeParse({
      type: 'ADD',
      aMin: 1,
      aMax: 5,
      bMin: 1,
      bMax: 5,
      rangeMin: 10,
      rangeMax: 5,
    })
    expect(result.success).toBe(false)
  })

  it('缺少 type 欄位應失敗（discriminated union）', () => {
    const result = QuestionParamsSchema.safeParse({
      aMin: 1,
      aMax: 5,
      bMin: 1,
      bMax: 5,
    })
    expect(result.success).toBe(false)
  })

  it('未知 type 應失敗', () => {
    const result = QuestionParamsSchema.safeParse({
      type: 'INVALID',
      aMin: 1,
      aMax: 5,
      bMin: 1,
      bMax: 5,
    })
    expect(result.success).toBe(false)
  })

  it('ADD sumMax 太小應失敗', () => {
    const result = QuestionParamsSchema.safeParse({
      type: 'ADD',
      aMin: 5,
      aMax: 10,
      bMin: 5,
      bMax: 10,
      sumMax: 1, // 小於 aMin + bMin
    })
    expect(result.success).toBe(false)
  })
})
