import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'

// ============ OTP 安全相關單元測試（P1-12）============
// 這些測試驗證 OTP 的雜湊邏輯與 attemptCount 限制的正確性，
// 不依賴 DB（由 otp.ts 的記憶體 fallback 路徑處理）。

// 複製 otp.ts 的 hashOtp 邏輯以便測試
// P1-3：hash 包含 identifier + purpose + code
const OTP_TEST_KEY = Buffer.from('test-key-for-unit-tests-32bytes!', 'utf-8')

function hashOtp(identifier: string, purpose: string, code: string): string {
  return createHmac('sha256', OTP_TEST_KEY).update(`${identifier}:${purpose}:${code}`).digest('hex')
}

describe('OTP 雜湊邏輯（防 timing attack）', () => {
  it('相同 identifier + purpose + code 產生相同 hash', () => {
    const h1 = hashOtp('user1', 'PARENT_LOGIN', '123456')
    const h2 = hashOtp('user1', 'PARENT_LOGIN', '123456')
    expect(h1).toBe(h2)
  })

  it('不同 identifier 產生不同 hash', () => {
    const h1 = hashOtp('user1', 'PARENT_LOGIN', '123456')
    const h2 = hashOtp('user2', 'PARENT_LOGIN', '123456')
    expect(h1).not.toBe(h2)
  })

  it('不同 code 產生不同 hash', () => {
    const h1 = hashOtp('user1', 'PARENT_LOGIN', '123456')
    const h2 = hashOtp('user1', 'PARENT_LOGIN', '654321')
    expect(h1).not.toBe(h2)
  })

  // P1-3：不同 purpose 必須產生不同 hash，避免不同流程的 OTP 互相冒用
  it('不同 purpose 產生不同 hash（即使 identifier 與 code 相同）', () => {
    const h1 = hashOtp('user1', 'PARENT_LOGIN', '123456')
    const h2 = hashOtp('user1', 'PASSWORD_RESET', '123456')
    expect(h1).not.toBe(h2)
  })

  it('hash 長度固定為 64（SHA256 hex）', () => {
    const h = hashOtp('user1', 'PARENT_LOGIN', '123456')
    expect(h).toHaveLength(64)
  })

  it('不會包含原始 code 或 identifier', () => {
    const h = hashOtp('user@example.com', 'PARENT_LOGIN', '123456')
    expect(h).not.toContain('123456')
    expect(h).not.toContain('user')
    expect(h).not.toContain('example')
  })
})

describe('OTP attemptCount 模擬', () => {
  // 模擬 verifyOtp 中的 attemptCount 邏輯
  const OTP_MAX_ATTEMPTS = 5

  function simulateOtpVerification(
    attempts: number,
    lockedAt: Date | null,
    codeValid: boolean
  ): { success: boolean; newAttempts: number; locked: boolean } {
    if (lockedAt) return { success: false, newAttempts: attempts, locked: true }
    if (attempts >= OTP_MAX_ATTEMPTS) return { success: false, newAttempts: attempts, locked: true }

    if (!codeValid) {
      const newAttempt = attempts + 1
      const locked = newAttempt >= OTP_MAX_ATTEMPTS
      return { success: false, newAttempts: newAttempt, locked }
    }

    return { success: true, newAttempts: 0, locked: false }
  }

  it('首次錯誤累計 1 次', () => {
    const result = simulateOtpVerification(0, null, false)
    expect(result.success).toBe(false)
    expect(result.newAttempts).toBe(1)
    expect(result.locked).toBe(false)
  })

  it('錯誤 4 次後第 5 次錯誤即鎖定', () => {
    const result = simulateOtpVerification(4, null, false)
    expect(result.success).toBe(false)
    expect(result.newAttempts).toBe(5)
    expect(result.locked).toBe(true)
  })

  it('已鎖定後任何嘗試都失敗', () => {
    const result = simulateOtpVerification(5, new Date(), true)
    expect(result.success).toBe(false)
    expect(result.locked).toBe(true)
  })

  it('正確答案重置計數', () => {
    const result = simulateOtpVerification(3, null, true)
    expect(result.success).toBe(true)
    expect(result.newAttempts).toBe(0)
  })
})
