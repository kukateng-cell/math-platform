'use server'

import { redirect } from 'next/navigation'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createSession, deleteSession, getSession } from '@/lib/session'
import { createCaptcha, verifyCaptcha } from '@/lib/captcha'
import { checkRateLimit } from '@/lib/rate-limit'
import { generateOtp, verifyOtp, createTempToken, verifyTempToken, canResendOtp, getResendCooldownSeconds } from '@/lib/otp'
import { sendOtpEmail } from '@/lib/email'
import { SignupFormSchema, LoginFormSchema, ChildProfileSchema, type FormState } from '@/lib/definitions'
import { revalidatePath } from 'next/cache'
import { SignJWT, jwtVerify } from 'jose'
import { getSessionKey } from '@/lib/secret'

// ============ 重新產生 CAPTCHA（供前端「換一題」按鈕呼叫）============
// 回傳新的 { question, token }，token 為新簽名的 JWT（5 分鐘有效）
// 使用 useActionState 相容簽名，避免 server action 直接呼叫失效問題
export async function refreshCaptchaAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: { question: string; token: string } | undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<{ question: string; token: string }> {
  return createCaptcha()
}

// PendingSignup 暫存時間（超過此時間的記錄在查詢時自動忽略）
const PENDING_SIGNUP_TTL_MINUTES = 10

// ============ 註冊 Step 1：驗證資料 + CAPTCHA → 發送 OTP ============
// P1-1：加入 identifier/IP rate limit
// P1-3：使用 upsert 處理重複 PendingSignup
export async function signup(state: FormState, formData: FormData): Promise<FormState> {
  const validated = SignupFormSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors, captcha: await createCaptcha() }
  }
  const { name, email, password } = validated.data

  // P1-1：IP/email rate limit for signup
  if (!(await checkRateLimit(`signup:${email}`, 3, 300_000))) {
    return { message: '嘗試次數過多，請稍後再試', captcha: await createCaptcha() }
  }

  // CAPTCHA 驗證
  const captchaToken = String(formData.get('captchaToken') || '')
  const captchaAnswer = String(formData.get('captchaAnswer') || '')
  if (!(await verifyCaptcha(captchaToken, captchaAnswer))) {
    return { message: '驗證碼錯誤，請重新作答', captcha: await createCaptcha() }
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return { errors: { email: ['這個 Email 已經註冊過了'] }, captcha: await createCaptcha() }
  }

  // 產生 OTP（用 email 作為 identifier）
  const otpCode = await generateOtp(email)

  // 哈希密碼，暫存
  const passwordHash = await bcrypt.hash(password, 10)

  // P1-3：使用 upsert 而非 create，處理 PendingSignup.email @unique 衝突。
  // 若使用者重複提交註冊表單，upsert 會更新既有記錄（重置 attemptCount、passwordHash 及 expiry），
  // 而非噴 500 錯誤。email 發送失敗時不回滾 pending（由 expiresAt 自動清理）。
  const expiresAt = new Date(Date.now() + PENDING_SIGNUP_TTL_MINUTES * 60 * 1000)
  const pending = await prisma.pendingSignup.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      attemptCount: 0,
      expiresAt,
    },
    create: { email, name, passwordHash, expiresAt },
  })

  // 寄送 OTP（在 upsert 之後，確保 DB 記錄已就緒）
  const emailResult = await sendOtpEmail(email, otpCode)
  if (!emailResult.success) {
    console.error('[EMAIL FAILED]', emailResult.error)
    // P1-3：email 發送失敗時清除 pending 記錄
    await prisma.pendingSignup.delete({ where: { id: pending.id } }).catch(() => {})
    return {
      message: '驗證碼發送失敗，請稍後再試',
      captcha: await createCaptcha(),
    }
  }

  // 用 pending.id 簽發 tempToken（JWT 10 分鐘有效），驗證 OTP 後用此 id 取出暫存資料建立用戶
  const KEY = getSessionKey()
  const tempToken = await new SignJWT({ email, pendingId: pending.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(KEY)

  const devOtp = process.env.NODE_ENV === 'development' ? otpCode : undefined

  return {
    otpRequired: true,
    tempToken,
    devOtp,
    message: `驗證碼已發送至 ${email.replace(/(.{3}).+@/, '$1***@')}`,
  }
}

// ============ 註冊 Step 2：驗證 OTP → 建立帳號 ============
// P1-1：加入 OTP 驗證 rate limit；OTP 錯誤次數移至 OtpCode.attemptCount（由 verifyOtp 處理）
export async function verifySignupOtp(state: FormState, formData: FormData): Promise<FormState> {
  const tempToken = String(formData.get('tempToken') || '')
  const otpCode = String(formData.get('otpCode') || '')

  if (!tempToken || !otpCode) {
    return { message: '缺少必要參數' }
  }

  // 解碼 tempToken 取出 pendingId
  let email: string
  let pendingId: string
  try {
    const KEY = getSessionKey()
    const { payload: decoded } = await jwtVerify(
      tempToken,
      KEY,
      { algorithms: ['HS256'] }
    )
    const p = decoded as { email: string; pendingId: string }
    email = p.email
    pendingId = p.pendingId
  } catch {
    return { message: '驗證已過期，請重新註冊' }
  }

  // P1-1：OTP 驗證 rate limit
  if (!(await checkRateLimit(`otp:signup:${email}`, 5, 60_000))) {
    return { message: '嘗試次數過多，請稍後再試' }
  }

  // 從 DB 取出暫存的註冊資料（同時過濾已過期的記錄）
  const pending = await prisma.pendingSignup.findFirst({
    where: { id: pendingId, expiresAt: { gt: new Date() } },
  })
  if (!pending) return { message: '驗證已過期，請重新註冊' }
  const { name, passwordHash } = pending

  // 驗證 OTP（用 email 作 identifier）
  // P1-1：attemptCount/lockedAt 由 OtpCode 模型與 verifyOtp 內部處理
  if (!(await verifyOtp(email, otpCode))) {
    return { message: '驗證碼錯誤或已過期' }
  }

  // 再次確認 email 未被註冊（可能在 OTP 等待期間被別人註冊）
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    await prisma.pendingSignup.delete({ where: { id: pendingId } })
    return { message: '此 Email 已在 OTP 驗證期間被註冊' }
  }

  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: 'PARENT' },
  })
  await prisma.pendingSignup.delete({ where: { id: pendingId } })

  // 帶入 user.tokenVersion，讓 getVerifiedSession 能比對版本實現角色變更即時失效
  await createSession({ userId: user.id, email: user.email, role: 'PARENT', tokenVersion: user.tokenVersion })
  redirect('/dashboard')
}

// ============ 註冊重新發送 OTP ============
export async function resendSignupOtp(state: FormState, formData: FormData): Promise<FormState> {
  const tempToken = String(formData.get('tempToken') || '')
  if (!tempToken) return { message: '階段已過期，請重新註冊' }

  // 解碼取得 email
  let email: string
  try {
    const { payload } = await jwtVerify(
      tempToken,
      getSessionKey(),
      { algorithms: ['HS256'] }
    )
    email = (payload as unknown as { email: string }).email
  } catch {
    return { message: '階段已過期，請重新註冊' }
  }

  if (!(await canResendOtp(email))) {
    const cooldown = await getResendCooldownSeconds(email)
    return { message: `請 ${cooldown} 秒後再重新發送` }
  }

  const otpCode = await generateOtp(email)
  const emailResult = await sendOtpEmail(email, otpCode)
  if (!emailResult.success) {
    console.error('[EMAIL FAILED]', emailResult.error)
    return {
      otpRequired: true,
      tempToken,
      message: '驗證碼發送失敗，請稍後再試',
    }
  }

  const devOtp = process.env.NODE_ENV === 'development' ? otpCode : undefined

  return {
    otpRequired: true,
    tempToken,
    devOtp,
    message: `驗證碼已重新發送至 ${email.replace(/(.{3}).+@/, '$1***@')}`,
  }
}

// ============ 登入 Step 1：驗證帳密 + CAPTCHA → 發送 OTP ============
// P1-1：使用獨立 rate-limit namespace（「login:」前綴），與 signup/reset 各自計算
export async function login(state: FormState, formData: FormData): Promise<FormState> {
  const validated = LoginFormSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors, captcha: await createCaptcha() }
  }
  const { email, password } = validated.data

  // CAPTCHA 驗證
  const captchaToken = String(formData.get('captchaToken') || '')
  const captchaAnswer = String(formData.get('captchaAnswer') || '')
  if (!(await verifyCaptcha(captchaToken, captchaAnswer))) {
    return { message: '驗證碼錯誤，請重新作答', captcha: await createCaptcha() }
  }

  // P1-1：獨立 namespace
  if (!(await checkRateLimit(`login:${email}`, 5, 60_000))) {
    return { message: '嘗試次數過多，請稍後再試', captcha: await createCaptcha() }
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { message: 'Email 或密碼不正確', captcha: await createCaptcha() }
  }

  // 產生 OTP 驗證碼
  const otpCode = await generateOtp(user.id)

  // 透過 Gmail SMTP 寄送驗證碼
  const emailResult = await sendOtpEmail(user.email, otpCode)
  if (!emailResult.success) {
    console.error('[EMAIL FAILED]', emailResult.error)
    // 寄送失敗：不謊稱「已發送」，讓使用者知道並可稍後重試
    return { message: '驗證碼發送失敗，請稍後再試', captcha: await createCaptcha() }
  }

  // 只有管理員在開發模式時才直接顯示 OTP（家長一律不顯示）
  const showOtp = process.env.NODE_ENV === 'development' && user.role === 'ADMIN'
  const devOtp = showOtp ? otpCode : undefined

  // 簽發 LOGIN_OTP_PENDING token：僅供 verifyLoginOtp / resendOtp 使用，
  // 不能用於重設密碼（resetPassword 只接受 PASSWORD_RESET_VERIFIED）
  const tempToken = await createTempToken(user.id, 'LOGIN_OTP_PENDING')

  return {
    otpRequired: true,
    tempToken,
    devOtp,
    message: `驗證碼已發送至 ${email.replace(/(.{3}).+@/, '$1***@')}`,
  }
}

// ============ 登入 Step 2：驗證 OTP → 建立 Session ============
// P1-1：加入 OTP 驗證 rate limit
export async function verifyLoginOtp(state: FormState, formData: FormData): Promise<FormState> {
  const tempToken = String(formData.get('tempToken') || '')
  const otpCode = String(formData.get('otpCode') || '')

  if (!tempToken || !otpCode) {
    return { message: '缺少必要參數' }
  }

  // 只接受 LOGIN_OTP_PENDING token（拒絕來自其他流程的 token）
  const decoded = await verifyTempToken(tempToken, 'LOGIN_OTP_PENDING')
  if (!decoded) {
    return { message: '驗證已過期，請重新登入' }
  }
  const userId = decoded.userId

  // P1-1：OTP 驗證 rate limit（獨立 namespace，與 login/email 層次區隔）
  if (!(await checkRateLimit(`otp:login:${userId}`, 5, 60_000))) {
    return { message: '嘗試次數過多，請稍後再試' }
  }

  if (!(await verifyOtp(userId, otpCode))) {
    return { message: '驗證碼錯誤或已過期' }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return { message: '使用者不存在' }

  // 帶入 user.tokenVersion，讓 getVerifiedSession 能比對版本實現角色變更即時失效
  await createSession({ userId: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion })
  redirect(user.role === 'ADMIN' ? '/admin' : '/dashboard')
}

// ============ 重新發送 OTP ============
export async function resendOtp(state: FormState, formData: FormData): Promise<FormState> {
  const tempToken = String(formData.get('tempToken') || '')

  if (!tempToken) {
    return { message: '階段已過期，請重新登入' }
  }

  // resendOtp 只接受 LOGIN_OTP_PENDING token（家長登入流程的重發）
  const decoded = await verifyTempToken(tempToken, 'LOGIN_OTP_PENDING')
  if (!decoded) {
    return { message: '階段已過期，請重新登入' }
  }
  const userId = decoded.userId

  // 檢查冷卻時間
  if (!(await canResendOtp(userId))) {
    const cooldown = await getResendCooldownSeconds(userId)
    return { message: `請 ${cooldown} 秒後再重新發送` }
  }

  // 產生新 OTP
  const otpCode = await generateOtp(userId)

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user) {
    const emailResult = await sendOtpEmail(user.email, otpCode)
    if (!emailResult.success) {
      console.error('[EMAIL FAILED]', emailResult.error)
      // 寄送失敗：不謊稱「已發送」。保留 otpRequired + tempToken 讓使用者可重試。
      return {
        otpRequired: true,
        tempToken,
        message: '驗證碼發送失敗，請稍後再試',
      }
    }
  }

  const emailMasked = user
    ? user.email.replace(/(.{3}).+@/, '$1***@')
    : '您的信箱'

  // 只有管理員在開發模式時才直接顯示 OTP
  const isAdmin = user?.role === 'ADMIN'
  const showOtp = process.env.NODE_ENV === 'development' && isAdmin
  const devOtp = showOtp ? otpCode : undefined

  return {
    otpRequired: true,
    tempToken,
    devOtp,
    message: `新驗證碼已發送至 ${emailMasked}`,
  }
}

// ============ 登出 ============
export async function logout() {
  await deleteSession()
  redirect('/login')
}

// ============ 孩子檔案 CRUD ============
export async function createChild(state: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession()
  if (!session) return { message: '請先登入' }

  const validated = ChildProfileSchema.safeParse({
    nickname: formData.get('nickname'),
    gradeLevel: formData.get('gradeLevel'),
  })
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  await prisma.childProfile.create({
    data: {
      ...validated.data,
      parentId: session.userId,
    },
  })
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function deleteChild(formData: FormData) {
  const session = await getSession()
  if (!session) throw new Error('未授權')

  const childId = String(formData.get('childId'))
  // 確認是這名家長的孩子，避免越權刪除
  await prisma.childProfile.deleteMany({
    where: { id: childId, parentId: session.userId },
  })
  revalidatePath('/dashboard')
}

export async function getCurrentUser() {
  const session = await getSession()
  if (!session) return null
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true },
  })
}

// ============================================================
// 忘記密碼（密碼重設）
// 流程：請求重設 (Email+CAPTCHA) → OTP 驗證 → 設定新密碼
// 沿用現有的 generateOtp / tempToken / verifyOtp 機制
// ============================================================

// ============ 忘記密碼 Step 1：輸入 Email → 發送 OTP ============
// P1-1：使用獨立 rate-limit namespace；Email 使用 EmailSchema 正規化
export async function requestPasswordReset(state: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') || '').trim().toLowerCase()

  if (!email) {
    return { message: '請輸入 Email', captcha: await createCaptcha() }
  }

  // CAPTCHA 驗證
  const captchaToken = String(formData.get('captchaToken') || '')
  const captchaAnswer = String(formData.get('captchaAnswer') || '')
  if (!(await verifyCaptcha(captchaToken, captchaAnswer))) {
    return { message: '驗證碼錯誤，請重新作答', captcha: await createCaptcha() }
  }

  // P1-1：獨立 namespace（「resetpwd:」），與 login/signup 各自計算
  if (!(await checkRateLimit(`resetpwd:${email}`, 3, 300_000))) {
    return { message: '嘗試次數過多，請稍後再試', captcha: await createCaptcha() }
  }

  const user = await prisma.user.findUnique({ where: { email } })

  // 基於安全：不論 email 是否存在，回應都一樣（避免列舉帳號）
  // 但只有 email 真的存在時才會發送 OTP
  // 忘記密碼為家長功能，一律不顯示開發模式 OTP
  let tempToken = ''
  if (user) {
    const otpCode = await generateOtp(user.id)
    const emailResult = await sendOtpEmail(user.email, otpCode)
    if (!emailResult.success) {
      console.error('[EMAIL FAILED]', emailResult.error)
      return {
        message: '驗證碼暫時無法發送，請稍後再試',
        captcha: await createCaptcha(),
      }
    }
    tempToken = await createTempToken(user.id, 'PASSWORD_RESET_OTP_PENDING')
  }

  return {
    otpRequired: true,
    tempToken,
    message: `若此 Email 已註冊，驗證碼已發送至 ${email.replace(/(.{3}).+@/, '$1***@')}`,
  }
}

// ============ 忘記密碼 Step 2：驗證 OTP → 取得重設權限 token ============
// P1-1：OTP 驗證 rate limit
export async function verifyResetOtp(state: FormState, formData: FormData): Promise<FormState> {
  const tempToken = String(formData.get('tempToken') || '')
  const otpCode = String(formData.get('otpCode') || '')

  if (!tempToken || !otpCode) {
    return { message: '缺少必要參數' }
  }

  // 只接受 PASSWORD_RESET_OTP_PENDING token（拒絕登入/其他流程的 token）
  const decoded = await verifyTempToken(tempToken, 'PASSWORD_RESET_OTP_PENDING')
  if (!decoded) {
    return { message: '驗證已過期，請重新申請重設密碼' }
  }
  const userId = decoded.userId

  // P1-1：OTP 驗證 rate limit
  if (!(await checkRateLimit(`otp:resetpwd:${userId}`, 5, 60_000))) {
    return { message: '嘗試次數過多，請稍後再試' }
  }

  if (!(await verifyOtp(userId, otpCode))) {
    return { message: '驗證碼錯誤或已過期' }
  }

  // OTP 通過 → 建立 DB grant（帶 jti）並簽發 PASSWORD_RESET_VERIFIED token。
  // resetPassword 必須在 transaction 中消耗此 grant，確保 token 一次性、不可重放。
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tokenVersion: true },
  })
  if (!user) {
    return { message: '驗證已過期，請重新申請重設密碼' }
  }

  const jti = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 與 token 同步 10 分鐘
  await prisma.passwordResetGrant.create({
    data: { userId, jti, expiresAt },
  })

  // 帶 jti（一次性消耗用）+ tokenVersion（綁定當前版本，密碼變更後版本遞增即失效）
  const resetToken = await createTempToken(userId, 'PASSWORD_RESET_VERIFIED', {
    jti,
    tokenVersion: user.tokenVersion,
  })
  return { ok: true, tempToken: resetToken, message: '驗證成功，請設定新密碼' }
}

// ============ 忘記密碼 Step 3：設定新密碼 ============
export async function resetPassword(state: FormState, formData: FormData): Promise<FormState> {
  const tempToken = String(formData.get('tempToken') || '')
  const password = String(formData.get('password') || '')
  const confirmPassword = String(formData.get('confirmPassword') || '')

  if (!tempToken) {
    return { message: '驗證已過期，請重新申請重設密碼' }
  }

  // 只接受 PASSWORD_RESET_VERIFIED token（OTP 驗證通過後簽發，帶 jti）
  const decoded = await verifyTempToken(tempToken, 'PASSWORD_RESET_VERIFIED')
  if (!decoded || !decoded.jti) {
    return { message: '驗證已過期，請重新申請重設密碼' }
  }
  const userId = decoded.userId
  const jti = decoded.jti

  // 密碼規則沿用註冊的 SignupFormSchema（至少 8 碼、含字母與數字）
  const pwdCheck = SignupFormSchema.shape.password.safeParse(password)
  if (!pwdCheck.success) {
    return { errors: { password: pwdCheck.error.errors.map((e) => e.message) } }
  }

  if (password !== confirmPassword) {
    return { message: '兩次輸入的密碼不一致' }
  }

  const passwordHash = await bcrypt.hash(password, 10)

  // ============ 單一 transaction：消耗 grant + 更新密碼 + 失效舊 session ============
  // 條件式 updateMany（consumedAt IS NULL）即為 idempotency gate：
  // 併發或重放請求只有第一個能匹配（count=1），其餘 count=0 → 拒絕。
  // tokenVersion 遞增使所有舊 session 立即失效（被盜 cookie 即時踢下線）。
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 只能消耗「未使用 + 未過期 + 屬於此使用者」的 grant
      const consumed = await tx.passwordResetGrant.updateMany({
        where: {
          jti,
          userId,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date() },
      })
      if (consumed.count === 0) {
        // grant 不存在 / 已被消耗 / 已過期 / 不屬於此使用者 → 拒絕
        throw new Error('GRANT_INVALID')
      }
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
        },
      })
      return true
    })
    if (!result) return { message: '驗證已過期，請重新申請重設密碼' }
  } catch {
    // GRANT_INVALID 或其他錯誤 → 不洩漏細節
    return { message: '驗證已過期或已被使用，請重新申請重設密碼' }
  }

  // 重設完成 → 引導回登入頁（tokenVersion 已遞增，舊 session 全部失效）
  return { ok: true, message: '密碼已重設成功，請使用新密碼登入' }
}

// ============ 家長更新孩子年級 ============
export async function updateChildGrade(formData: FormData) {
  const session = await getSession()
  if (!session) throw new Error('請先登入')

  const childId = String(formData.get('childId') || '')
  const gradeLevel = String(formData.get('gradeLevel') || '')

  const validGrades = ['K', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'] as const
  if (!validGrades.includes(gradeLevel as typeof validGrades[number])) {
    throw new Error('無效的年級')
  }

  // 確認是這名家長的孩子
  const child = await prisma.childProfile.findFirst({
    where: {
      id: childId,
      parentId: session.userId,
    },
  })
  if (!child) throw new Error('找不到孩子或無權限')

  await prisma.childProfile.update({
    where: { id: childId },
    data: { gradeLevel },
  })

  revalidatePath(`/children/${childId}`)
  revalidatePath('/dashboard')
}

// ====================================================================
// 帳號刪除（GDPR 被遺忘權 / Right to Erasure）
// --------------------------------------------------------------------
// 家長可永久刪除自己的帳號。刪除範圍：
// - 帳號本身（User）
// - 自己建立的孩子檔案（ChildProfile, parentId 關聯）→ 連帶 sessions/
//   attempts/mastery/badges（schema 已設 onDelete: Cascade）
// - 自主學習孩子的綁定關係（ParentChild，但「不刪」孩子本人——他們有獨立帳號）
//
// 安全：必須重新輸入密碼確認（避免誤刪 / 被盜用後惡意刪除）。
// 刪除後立即登出並回首頁。此操作不可復原。
// ====================================================================

export type DeleteAccountState =
  | { errors?: Record<string, string[]>; message?: string; ok?: boolean }
  | undefined

export async function deleteAccount(state: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const session = await getSession()
  if (!session) throw new Error('請先登入')

  const password = String(formData.get('password') || '')
  const confirmText = String(formData.get('confirm') || '').trim()

  if (!password) {
    return { errors: { password: ['請輸入密碼以確認身份'] } }
  }

  // 二次確認：必須輸入「刪除我的帳號」
  if (confirmText !== '刪除我的帳號') {
    return { errors: { confirm: ['請輸入「刪除我的帳號」以確認'] } }
  }

  // 驗證密碼（重新確認身份）
  const user = await prisma.user.findUnique({ where: { id: session.userId } })
  if (!user) {
    return { message: '找不到帳號' }
  }
  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return { errors: { password: ['密碼不正確'] } }
  }

  // 執行刪除：
  // 1. 先解除與「自主學習孩子」的綁定（只斷 ParentChild，不刪孩子本人）
  // 2. 再刪 User → cascade 自動清掉 parentId 關聯的孩子及其全部學習資料
  await prisma.$transaction([
    prisma.parentChild.deleteMany({ where: { parentId: session.userId } }),
    prisma.user.delete({ where: { id: session.userId } }),
  ])

  await deleteSession()
  revalidatePath('/dashboard')
  redirect('/')
}
