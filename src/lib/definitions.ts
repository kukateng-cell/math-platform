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
// 注意：discriminatedUnion 要求每個分支是純 ZodObject（不可被 refine/superRefine 包裹），

// 按題型區分的參數驗證
// 每個 variant 使用 .passthrough() 讓 interaction/rangeMin/rangeMax 等
// 額外欄位可通過 discriminatedUnion 進入 superRefine 層進行驗證
const AddParamsSchema = z.object({
  type: z.literal('ADD'),
  aMin: z.number().int(),
  aMax: z.number().int(),
  bMin: z.number().int(),
  bMax: z.number().int(),
  sumMax: z.number().int().optional(),
}).passthrough()

const SubParamsSchema = z.object({
  type: z.literal('SUB'),
  aMin: z.number().int(),
  aMax: z.number().int(),
  bMin: z.number().int(),
  bMax: z.number().int(),
}).passthrough()

const MulParamsSchema = z.object({
  type: z.literal('MUL'),
  aMin: z.number().int(),
  aMax: z.number().int(),
  bMin: z.number().int(),
  bMax: z.number().int(),
}).passthrough()

// DIV 參數（禁止 bMin/bMax 包含 0）
const DivParamsSchema = z.object({
  type: z.literal('DIV'),
  aMin: z.number().int(),
  aMax: z.number().int(),
  bMin: z.number().int(),
  bMax: z.number().int(),
  aMultipleOfB: z.boolean().optional(),
}).passthrough()

const WordProblemParamsSchema = z.object({
  type: z.literal('WORD_PROBLEM'),
  aMin: z.number().int(),
  aMax: z.number().int(),
  bMin: z.number().int(),
  bMax: z.number().int(),
  sumMax: z.number().int().optional(),
  operation: z.enum(['add', 'sub', 'mul', 'div']).optional(),
}).passthrough()

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
  if (typeof p.sumMax === 'number' && typeof p.aMin === 'number' && typeof p.bMin === 'number' && p.sumMax < p.aMin + p.bMin) {
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
  name: z.string().min(2, '請輸入至少 2 個字元的稱呼').trim(),
  email: EmailSchema,
  password: z
    .string()
    .min(8, '密碼至少 8 個字元')
    .regex(/[a-zA-Z]/, '密碼需包含至少一個英文字母')
    .regex(/[0-9]/, '密碼需包含至少一個數字')
    .trim(),
})

// 登入表單驗證（P1-2：Email 統一 lowercase 正規化）
export const LoginFormSchema = z.object({
  email: EmailSchema,
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
