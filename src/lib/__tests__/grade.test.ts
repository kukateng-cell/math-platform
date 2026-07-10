import { describe, it, expect } from 'vitest'
import {
  GRADE_ORDER,
  gradeRank,
  canAccessGrade,
  accessibleGrades,
  getNextGrade,
  isLastGrade,
} from '../grade'

// ============ grade.ts 單元測試 ============
// 年級順序與權限是練習路由的安全核心（防止低年級越級看高年級技能），
// 這裡針對邊界與典型情境做覆蓋。

describe('GRADE_ORDER', () => {
  it('涵蓋 K 到 G6 共 7 個年級', () => {
    expect(GRADE_ORDER).toEqual(['K', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'])
  })
})

describe('gradeRank', () => {
  it('K 為 0，之後遞增', () => {
    expect(gradeRank('K')).toBe(0)
    expect(gradeRank('G1')).toBe(1)
    expect(gradeRank('G6')).toBe(6)
  })

  it('未知年級回傳 -1（fail-closed）', () => {
    expect(gradeRank('G9')).toBe(-1)
    expect(gradeRank('')).toBe(-1)
    expect(gradeRank('g1')).toBe(-1)
  })
})

describe('canAccessGrade', () => {
  it('同年級可存取', () => {
    expect(canAccessGrade('G2', 'G2')).toBe(true)
  })

  it('高年級可往下複習低年級', () => {
    expect(canAccessGrade('G3', 'K')).toBe(true)
    expect(canAccessGrade('G3', 'G2')).toBe(true)
  })

  it('低年級不可越級看高年級', () => {
    expect(canAccessGrade('K', 'G1')).toBe(false)
    expect(canAccessGrade('G2', 'G3')).toBe(false)
  })

  it('K 只能看 K', () => {
    expect(canAccessGrade('K', 'K')).toBe(true)
    expect(canAccessGrade('K', 'G1')).toBe(false)
  })
})

describe('accessibleGrades', () => {
  it('回傳自身與以下所有年級', () => {
    expect(accessibleGrades('K')).toEqual(['K'])
    expect(accessibleGrades('G1')).toEqual(['K', 'G1'])
    expect(accessibleGrades('G3')).toEqual(['K', 'G1', 'G2', 'G3'])
  })

  it('G6 可存取全部年級', () => {
    expect(accessibleGrades('G6')).toEqual(['K', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'])
  })

  it('未知年級回傳空陣列（fail-closed）', () => {
    expect(accessibleGrades('XYZ')).toEqual([])
    expect(accessibleGrades('')).toEqual([])
  })
})

describe('getNextGrade', () => {
  it('K → G1，G1 → G2 …', () => {
    expect(getNextGrade('K')).toBe('G1')
    expect(getNextGrade('G1')).toBe('G2')
    expect(getNextGrade('G5')).toBe('G6')
  })

  it('G6 已是最高年級，回傳 null', () => {
    expect(getNextGrade('G6')).toBeNull()
  })
})

describe('isLastGrade', () => {
  it('G6 為最後年級', () => {
    expect(isLastGrade('G6')).toBe(true)
  })

  it('其他年級非最後', () => {
    expect(isLastGrade('G5')).toBe(false)
    expect(isLastGrade('K')).toBe(false)
  })
})
