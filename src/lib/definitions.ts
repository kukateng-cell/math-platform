import { z } from 'zod'

// ============ 參數化題目參數驗證（Admin 建立/編輯/Seed 共用）============
export const QuestionParamsSchema = z.object({
  aMin: z.number().int(),
  aMax: z.number().int(),
  bMin: z.number().int(),
  bMax: z.number().int(),
  sumMax: z.number().int().optional(),
  interaction: z.enum(['choice', 'numberline', 'fillin']).optional(),
  rangeMin: z.number().int().optional(),
  rangeMax: z.number().int().optional(),
  inputMode: z.enum(['numeric', 'text']).optional(),
  maxLength: z.number().int().positive().optional(),
  placeholder: z.string().optional(),
  aMultipleOfB: z.boolean().optional(),
  operation: z.enum(['add', 'sub', 'mul', 'div']).optional(),
}).refine((p) => p.aMin <= p.aMax, {
  message: 'aMin 必須小於等於 aMax',
}).refine((p) => p.bMin <= p.bMax, {
  message: 'bMin 必須小於等於 bMax',
})

// 註冊表單驗證
export const SignupFormSchema = z.object({
  name: z.string().min(2, '請輸入至少 2 個字元的稱呼').trim(),
  email: z.string().email('請輸入有效的 Email').trim(),
  password: z
    .string()
    .min(8, '密碼至少 8 個字元')
    .regex(/[a-zA-Z]/, '密碼需包含至少一個英文字母')
    .regex(/[0-9]/, '密碼需包含至少一個數字')
    .trim(),
})

// 登入表單驗證
export const LoginFormSchema = z.object({
  email: z.string().email('請輸入有效的 Email').trim(),
  password: z.string().min(1, '請輸入密碼').trim(),
})

// 孩子檔案驗證
export const ChildProfileSchema = z.object({
  nickname: z.string().min(1, '請輸入孩子的暱稱').max(20, '暱稱最多 20 字').trim(),
  gradeLevel: z.enum(['K', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'], {
    errorMap: () => ({ message: '請選擇年級' }),
  }),
})

// 通用回傳狀態
export type FormState =
  | {
      errors?: Record<string, string[]>
      message?: string
      ok?: boolean
      // 人機驗證
      captcha?: { question: string; token: string }
      // OTP 雙步驟登入
      otpRequired?: boolean
      tempToken?: string
      // 開發模式直接顯示 OTP（正式環境不該有這個）
      devOtp?: string
    }
  | undefined
