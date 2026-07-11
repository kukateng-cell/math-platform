import { z } from 'zod'

// ============ Email 正規化工具（P1-2：統一 lowercase）============
// 所有表單驗證中的 email 欄位都應使用此方法：
//   1. trim 去除前後空白
//   2. transform 轉小寫
// 避免 `User@Example.com` 與 `user@example.com` 成為兩個帳號，
// 並確保登入/重設密碼/學生綁定等流程的 email 比對一致。
// 注意順序：先 trim 再 email 驗證，避免前後空白導致 email 驗證失敗
export const EmailSchema = z.string().trim().email('請輸入有效的 Email').transform((v) => v.toLowerCase())

// ============ 參數化題目參數驗證（P1-8：使用 discriminated union）============
// 注意：discriminatedUnion 要求每個分支是純 ZodObject（不可被 refine/superRefine 包裹）。
//
// P1-10：各 variant 使用 .strict()，不再使用 .passthrough()，
// 確保 type 只能由 literal 校驗通過，不接受 JSON 中的假 type。
// QuestionParamsBase 明確定義所有合法額外欄位（interaction/range/inputMode 等）。

// 共用基底：所有參數化題型共用的欄位與常見表單額外欄位
const QuestionParamsBase = z.object({
  aMin: z.number().int(),
  aMax: z.number().int(),
  bMin: z.number().int(),
  bMax: z.number().int(),
  // 表單額外欄位（互動模式、數線範圍等），各題型可選
  rangeMin: z.number().int().optional(),
  rangeMax: z.number().int().optional(),
  interaction: z.enum(['choice', 'numberline', 'fillin']).optional(),
  inputMode: z.enum(['numeric', 'text']).optional(),
  placeholder: z.string().optional(),
})

const AddParamsSchema = QuestionParamsBase.merge(z.object({
  type: z.literal('ADD'),
  sumMax: z.number().int().optional(),
})).strict()

const SubParamsSchema = QuestionParamsBase.merge(z.object({
  type: z.literal('SUB'),
})).strict()

const MulParamsSchema = QuestionParamsBase.merge(z.object({
  type: z.literal('MUL'),
})).strict()

// DIV 參數（禁止 bMin/bMax 包含 0）
const DivParamsSchema = QuestionParamsBase.merge(z.object({
  type: z.literal('DIV'),
  aMultipleOfB: z.boolean().optional(),
})).strict()

const WordProblemParamsSchema = QuestionParamsBase.merge(z.object({
  type: z.literal('WORD_PROBLEM'),
  sumMax: z.number().int().optional(),
  operation: z.enum(['add', 'sub', 'mul', 'div']).optional(),
})).strict()

// 完整的題目參數驗證 schema（P1-8：最終合併後的 JSON 驗證）
// 使用 discriminatedUnion 確保型別安全，再透過 .superRefine 做跨欄位驗證
export const QuestionParamsSchema = z.discriminatedUnion('type', [
  AddParamsSchema,
  SubParamsSchema,
  MulParamsSchema,
  DivParamsSchema,
  WordProblemParamsSchema,
]).superRefine((p, ctx) => {
  // 通用欄位驗證
  if (p.aMin > p.aMax) {
    ctx.addIssue({ code: 'custom', message: 'aMin 必須小於等於 aMax', path: ['aMin'] })
  }
  if (p.bMin > p.bMax) {
    ctx.addIssue({ code: 'custom', message: 'bMin 必須小於等於 bMax', path: ['bMin'] })
  }
  // sumMax 只在 ADD/WORD_PROBLEM 存在，需先用 'in' 判斷再取
  if ('sumMax' in p && typeof p.sumMax === 'number' && p.sumMax < p.aMin + p.bMin) {
    ctx.addIssue({ code: 'custom', message: 'sumMax 必須大於等於最小可能和 (aMin+bMin)', path: ['sumMax'] })
  }
  // DIV 除數不可為 0
  if (p.type === 'DIV' || (p.type === 'WORD_PROBLEM' && p.operation === 'div')) {
    if (p.bMin <= 0) {
      ctx.addIssue({ code: 'custom', message: 'DIV/WORD_PROBLEM div 操作中 bMin 必須大於 0（除數不可為 0）', path: ['bMin'] })
    }
    if (p.bMax <= 0) {
      ctx.addIssue({ code: 'custom', message: 'DIV/WORD_PROBLEM div 操作中 bMax 必須大於 0（除數不可為 0）', path: ['bMax'] })
    }
  }
  // rangeMin < rangeMax
  if (typeof p.rangeMin === 'number' && typeof p.rangeMax === 'number' && p.rangeMin >= p.rangeMax) {
    ctx.addIssue({ code: 'custom', message: 'rangeMin 必須小於 rangeMax', path: ['rangeMin'] })
  }
})

// 註冊表單驗證（P1-2：Email 統一 lowercase 正規化）
export const SignupFormSchema = z.object({
  name: z.string().min(2, '請輸入至少 2 個字元的稱呼').max(100, '稱呼不可超過 100 字').trim(),
  email: EmailSchema,
  password: z
    .string()
    .min(8, '密碼至少 8 個字元')
    .max(128, '密碼不可超過 128 字')
    .regex(/[a-zA-Z]/, '密碼需包含至少一個英文字母')
    .regex(/[0-9]/, '密碼需包含至少一個數字')
    .trim(),
})

// 登入表單驗證（P1-2：Email 統一 lowercase 正規化）
export const LoginFormSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, '請輸入密碼').max(128, '密碼不可超過 128 字').trim(),
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
