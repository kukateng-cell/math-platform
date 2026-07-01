import { z } from 'zod'

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
  gradeLevel: z.enum(['K', 'G1', 'G2'], {
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
