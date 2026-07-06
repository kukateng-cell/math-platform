import nodemailer from 'nodemailer'

// ====================================================================
// Gmail SMTP 寄信（支援 Vercel serverless 環境）
// --------------------------------------------------------------------
// 用 Gmail App Password 免費發送驗證碼郵件，可寄給任何人。
// 未設定 SMTP 時自動降級為開發模式（console.log）。
//
// Vercel 部署：在 Vercel Dashboard → Settings → Environment Variables
// 新增 SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM，
// 重新部署即可。
// ====================================================================

const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com'
const smtpPort = Number(process.env.SMTP_PORT) || 587
const smtpUser = process.env.SMTP_USER
const smtpPass = process.env.SMTP_PASS
const fromEmail = process.env.SMTP_FROM || smtpUser || 'noreply@math-platform.local'

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter
  if (!smtpUser || !smtpPass) return null

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
    // Vercel serverless 環境連線較慢，加長逾時避免被中斷
    connectionTimeout: 15000,  // 15 秒
    greetingTimeout: 15000,
    socketTimeout: 30000,
  })
  return transporter
}

// 寄送 OTP 驗證碼郵件
export async function sendOtpEmail(
  to: string,
  otpCode: string
): Promise<{ success: boolean; error?: string }> {
  const t = getTransporter()

  if (!t) {
    // 無 SMTP 設定 → 開發模式：只輸出到 console
    console.log(`[DEV EMAIL] To: ${to} | OTP: ${otpCode}`)
    return { success: false, error: 'SMTP 未設定（缺少 SMTP_USER / SMTP_PASS）' }
  }

  try {
    await t.sendMail({
      from: fromEmail,
      to,
      subject: '您的驗證碼 - 數學小達人',
      text: `您的驗證碼是：${otpCode}\n\n驗證碼有效期限為 5 分鐘。\n\n如果這不是您本人的操作，請忽略此信件。`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <div style="text-align:center;font-size:40px;margin-bottom:16px">🔢</div>
          <h1 style="font-size:20px;text-align:center;margin-bottom:24px">數學小達人 - 驗證碼</h1>
          <div style="background:#f0f5ff;border-radius:12px;padding:24px;text-align:center">
            <p style="color:#555;margin-bottom:12px">您的驗證碼</p>
            <p style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#2563eb;margin:0">
              ${otpCode}
            </p>
          </div>
          <p style="color:#999;font-size:13px;margin-top:24px;text-align:center">
            驗證碼有效期限為 5 分鐘
          </p>
        </div>
      `,
    })
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '發送失敗'
    console.error(`[EMAIL ERROR] ${msg}`)
    return { success: false, error: msg }
  }
}
