'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createSession, deleteSession, getSession } from '@/lib/session'
import { deleteChildSession } from '@/lib/child-session'
import { createCaptcha, verifyCaptcha } from '@/lib/captcha'
import { checkRateLimit } from '@/lib/rate-limit'
import { generateOtp, verifyOtp, createTempToken, createDummyTempToken, verifyTempToken, canResendOtp, getResendCooldownSeconds, createPasswordResetToken, verifyPasswordResetToken } from '@/lib/otp'
import { sendOtpEmail } from '@/lib/email'
import { SignupFormSchema, LoginFormSchema, ChildProfileSchema, type FormState } from '@/lib/definitions'
import type { User, GradeLevel as ChildGradeLevel } from '@/generated/prisma'
import { revalidatePath } from 'next/cache'
import { SignJWT, jwtVerify } from 'jose'
import { getSessionKey } from '@/lib/secret'

// 在所有環境直接顯示 OTP 驗證碼（配合外層 role === 'ADMIN' 判斷，僅 admin 可見）
function shouldShowDevOtp(): boolean {
  return true
}

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

// P1-4：誘餌 bcrypt 雜湊。登入時若使用者不存在，仍對此雜湊執行 bcrypt.compare，
// 使回應耗時與真實使用者相近，避免攻擊者以 timing 差異枚舉帳號。
// 此雜湊對應一個隨機字串，任何真實密碼比對結果必為 false。
const DUMMY_BCRYPT_HASH = '$2a$10$kEBcFogOj2nTrUPpAFQtGeVmdvm596ZU2A9iP45tgJyh9pr1aqNiW'

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

  // 產生 OTP（用 email 作為 identifier；purpose=PARENT_SIGNUP）
  const otpCode = await generateOtp(email, 'PARENT_SIGNUP')

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

  const devOtp = shouldShowDevOtp() ? otpCode : undefined

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

  // 驗證 OTP（用 email 作 identifier；purpose=PARENT_SIGNUP）
  // P1-1：attemptCount/lockedAt 由 OtpCode 模型與 verifyOtp 內部處理
  if (!(await verifyOtp(email, 'PARENT_SIGNUP', otpCode))) {
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

  if (!(await canResendOtp(email, 'PARENT_SIGNUP'))) {
    const cooldown = await getResendCooldownSeconds(email, 'PARENT_SIGNUP')
    return { message: `請 ${cooldown} 秒後再重新發送` }
  }

  const otpCode = await generateOtp(email, 'PARENT_SIGNUP')
  const emailResult = await sendOtpEmail(email, otpCode)
  if (!emailResult.success) {
    console.error('[EMAIL FAILED]', emailResult.error)
    return {
      otpRequired: true,
      tempToken,
      message: '驗證碼發送失敗，請稍後再試',
    }
  }

  const devOtp = shouldShowDevOtp() ? otpCode : undefined

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

  const user: User | null = await prisma.user.findUnique({ where: { email } })
  // P1-4：帳號枚舉（timing）防護。不論使用者是否存在都執行一次 bcrypt compare，
  // 避免攻擊者從回應時間差（使用者不存在時跳過 compare）推斷帳號是否存在。
  // 不存在時對預先計算的誘餌雜湊比對，結果必為 false 但耗時與真實比對相近。
  const passwordOk = user
    ? await bcrypt.compare(password, user.passwordHash)
    : await bcrypt.compare(password, DUMMY_BCRYPT_HASH)
  if (!user || !passwordOk) {
    return { message: 'Email 或密碼不正確', captcha: await createCaptcha() }
  }

  // 產生 OTP 驗證碼（identifier=userId；purpose=PARENT_LOGIN）
  const otpCode = await generateOtp(user.id, 'PARENT_LOGIN')

  // 透過 Gmail SMTP 寄送驗證碼
  const emailResult = await sendOtpEmail(user.email, otpCode)
  if (!emailResult.success) {
    console.error('[EMAIL FAILED]', emailResult.error)
    // 寄送失敗：不謊稱「已發送」，讓使用者知道並可稍後重試
    return { message: '驗證碼發送失敗，請稍後再試', captcha: await createCaptcha() }
  }

  // 只有管理員在開發模式時才直接顯示 OTP（家長一律不顯示）
  const showOtp = shouldShowDevOtp() && user.role === 'ADMIN'
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

  if (!(await verifyOtp(userId, 'PARENT_LOGIN', otpCode))) {
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
  if (!(await canResendOtp(userId, 'PARENT_LOGIN'))) {
    const cooldown = await getResendCooldownSeconds(userId, 'PARENT_LOGIN')
    return { message: `請 ${cooldown} 秒後再重新發送` }
  }

  // 產生新 OTP
  const otpCode = await generateOtp(userId, 'PARENT_LOGIN')

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
  const showOtp = shouldShowDevOtp() && isAdmin
  const devOtp = showOtp ? otpCode : undefined

  return {
    otpRequired: true,
    tempToken,
    devOtp,
    message: `新驗證碼已發送至 ${emailMasked}`,
  }
}

// ============ 登出 ============
// P2-7：同時清除家長與孩子 cookie
export async function logout() {
  await deleteSession()
  await deleteChildSession()
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

  const childId = String(formData.get('childId') || '').trim()
  if (!childId || childId.length > 50) throw new Error('參數不合法')
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

  // P1-4：帳號枚舉防護。不論 email 是否存在，一律回傳「格式相同」的 tempToken
  // 與相同訊息，讓攻擊者無法從 Network payload（tempToken 是否為空）或回應
  // 文字判斷帳號是否存在。
  //   - 帳號存在且寄信成功 → 真實 token（下一步可完成重設）
  //   - 帳號不存在 / SMTP 故障 → 誘餌 token（帶隨機 userId，格式與真實一致；
  //     下一步 OTP 比對必然失敗，只回傳通用錯誤，不建立任何 DB 記錄）
  // SMTP 故障時也使用誘餌 token，避免「暫時無法發送」vs「已發送」的訊息差異洩漏。
  // 忘記密碼為家長功能，一律不顯示開發模式 OTP
  let tempToken: string
  if (user) {
    // 忘記密碼：identifier=userId；purpose=PASSWORD_RESET（與 PARENT_LOGIN 隔離）
    const otpCode = await generateOtp(user.id, 'PASSWORD_RESET')
    const emailResult = await sendOtpEmail(user.email, otpCode)
    if (emailResult.success) {
      tempToken = await createTempToken(user.id, 'PASSWORD_RESET_OTP_PENDING')
    } else {
      console.error('[EMAIL FAILED]', emailResult.error)
      // SMTP 故障：改用誘餌 token，回應與成功時無法區分
      tempToken = await createDummyTempToken('PASSWORD_RESET_OTP_PENDING')
    }
  } else {
    tempToken = await createDummyTempToken('PASSWORD_RESET_OTP_PENDING')
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

  if (!(await verifyOtp(userId, 'PASSWORD_RESET', otpCode))) {
    return { message: '驗證碼錯誤或已過期' }
  }

  // OTP 通過 → 建立密碼重設授權（PasswordResetGrant）並發給綁定的重設 token。
  // grant 快照當下 user.tokenVersion；resetPassword 會比對此值，確保
  // 任何使 tokenVersion 變動的事件（另一次重設、角色變更）都會令舊 grant 失效。
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, tokenVersion: true },
  })
  if (!user) {
    return { message: '找不到帳號' }
  }

  const grant = await prisma.passwordResetGrant.create({
    data: { userId: user.id, tokenVersion: user.tokenVersion },
  })

  const resetToken = await createPasswordResetToken({
    userId: user.id,
    jti: grant.id,
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

  // 解碼重設 token（夾帶 userId / jti / tokenVersion）
  const payload = await verifyPasswordResetToken(tempToken)
  if (!payload) {
    return { message: '驗證已過期，請重新申請重設密碼' }
  }

  // 密碼規則沿用註冊的 SignupFormSchema（至少 8 碼、含字母與數字）
  const pwdCheck = SignupFormSchema.shape.password.safeParse(password)
  if (!pwdCheck.success) {
    return { errors: { password: pwdCheck.error.errors.map((e) => e.message) } }
  }

  if (password !== confirmPassword) {
    return { message: '兩次輸入的密碼不一致' }
  }

  // 查驗授權紀錄：必須存在、尚未消耗、tokenVersion 與當前 user 一致。
  // tokenVersion 不一致代表此 grant 簽發後 user 已發生變動
  // （例如已用另一個 grant 重設過、或角色被變更），此 grant 視為過期。
  const [user, grant] = await Promise.all([
    prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, tokenVersion: true },
    }),
    prisma.passwordResetGrant.findUnique({ where: { id: payload.jti } }),
  ])

  if (!user) {
    return { message: '找不到帳號' }
  }
  if (!grant || grant.consumedAt || grant.tokenVersion !== user.tokenVersion) {
    return { message: '驗證已過期，請重新申請重設密碼' }
  }

  // 原子化執行：更新密碼 + 遞增 tokenVersion（踢掉所有舊 session）
  // + 作廢該使用者所有 outstanding grants（防「兩次 OTP → 兩個 grant」重放）
  const passwordHash = await bcrypt.hash(password, 10)
  const now = new Date()
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    }),
    prisma.passwordResetGrant.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: now },
    }),
  ])

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
    data: { gradeLevel: gradeLevel as ChildGradeLevel },
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
