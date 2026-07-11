# 數學小達人 | K-G6 數學練習平台

K-G6 數學學習平台。家長建立孩子檔案，孩子做題，系統記錄表現並給出規則式下一步推薦。涵蓋從數數到分數乘除法的完整學習路徑，具備遊戲化激勵機制（星星、連續練習、成就徽章）和管理後台。

## 技術棧

- **Next.js 16**（App Router）+ TypeScript
- **React 19** + **Tailwind CSS v4**（`@import "tailwindcss"`）
- **Prisma 7**（driver adapter 模式）+ **PostgreSQL**（Supabase）
- 後端主要用 **Server Actions**，輔以 **Route Handlers**（`/api/cron/*` 排程清理、`/api/export/*` CSV 匯出）
- **jose**（JWT, httpOnly cookie）+ **bcryptjs** 自管 session
- **Zod** 表單驗證
- **nodemailer** Email OTP 寄送

## 快速開始

```bash
# 1. 安裝依賴（會自動 prisma generate）
npm install

# 2. 設定環境變數
cp .env.example .env   # 若有範例檔；或手動建立 .env
# SESSION_SECRET：產生方式 openssl rand -base64 32
# DATABASE_URL：PostgreSQL 連線字串（Supabase pooled，port 6543）
# SMTP_USER / SMTP_PASS：Gmail App Password（OTP 寄信用）

# 3a. 全新空 DB：同步 schema + 填入種子資料
npm run db:push            # 開發環境快速同步（不寫 migration 紀錄）
# 建議改用 npm run db:migrate:dev  → 同步 schema 並建立可追蹤的 migration 紀錄
npm run db:bootstrap

# 3b. 既有 DB（已有學習資料）：僅同步題庫（不刪除既有作答/掌握度）
npm run db:push
npm run db:content:sync

# 4. 啟動開發伺服器
npm run dev
```

> **⚠️ seed 指令的破壞性差異（務必分清楚）**：
> - `npm run db:bootstrap`：**破壞性**。內部已帶 `ALLOW_DESTRUCTIVE_SEED=true`，會**清除所有作答 / 練習 session / 掌握度 / 題目模板**後重建，**僅適合全新資料庫**。
> - `npm run db:seed` / `npm run db:content:sync`：**非破壞性**（預設）。偵測到既有作答紀錄時會自動跳過題目重建，只 upsert 技能與題目；在已有正式資料的環境可用來補題庫。
> - 欲強制重建題庫：`ALLOW_DESTRUCTIVE_SEED=true npm run db:seed`（會清空學習資料，請三思）。
> - 開發用 `db:push` 只更新 schema 不留 migration 紀錄；**正式環境請改用 `db:migrate:deploy`**（見下方「部署」）。

## 管理員帳號

### 開發環境

```bash
npm run db:bootstrap   # 建立 admin@math.local / admin123
```

### 正式環境

正式環境必須設定**可收 OTP 的真實 Email**，seed 會強制檢查：

```bash
# 方式一：透過 seed 一併建立（需 ALLOW_DESTRUCTIVE_SEED=true）
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=your-strong-password npm run db:bootstrap

# 方式二：獨立 CLI（推薦，不影響既有資料）
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=your-strong-password npm run admin:bootstrap

# 互動模式（會提示輸入）
npm run admin:bootstrap

# 重設密碼（保留 Email，僅更新密碼 + 失效舊 session）
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=new-password npm run admin:bootstrap -- --force
```

正式 seed 若未設定 `ADMIN_EMAIL` 或密碼不合規格，會直接終止並印出提示，不會建立無法收 OTP 的 `.local` 帳號。

打開 <http://localhost:3000>

## 預設帳號

| 角色 | Email | 密碼 |
| --- | --- | --- |
| 管理員 | `admin@math.local` | 見下方說明 |

> **管理員密碼不再寫死**，避免弱密碼被帶到正式環境：
> - **開發環境**（`NODE_ENV !== production`，且未設定 `ADMIN_PASSWORD`）：預設密碼為 `admin123`，僅方便本機測試。
> - **正式環境**：設定環境變數 `ADMIN_PASSWORD`（至少 8 碼，且不可為 `admin123`）。
>   若未設定或設為弱密碼，seed 會**自動產生一次性隨機密碼**並印在終端機，請登入後立即修改。
> - 若管理員已存在，seed **不會**覆蓋其密碼。

家長帳號請自行註冊（雙步驟：CAPTCHA + Email OTP）。學生可自助註冊或由家長建檔。

## 年級涵蓋範圍

| 年級 | 技能數 | 內容 |
| --- | --- | --- |
| K（幼兒園） | 3 | 數數、圖形辨認、數量比較 |
| G1 | 3 | 10/20 以內加減法 |
| G2 | 6 | 文字題、乘法入門、6-9 乘法、九九乘法、除法入門、基礎除法 |
| G3 | 8 | 百以內加減、乘法/除法進階、三位數加減、分數基礎、時間計算、面積周長、四則混合 |
| G4 | 9 | 分數比較、小數初步、大數乘法/除法、運算規律、三角形、面積、直式除法 |
| G5 | 7 | 小數加減乘除、分數加減、體積、方程、多邊形公式、因數倍數 |
| G6 | 4+ | 分數乘除法、比與比例（持續擴充） |

## 核心流程

1. **家長註冊**（雙步驟：CAPTCHA + Email OTP）→ 建立孩子檔案（選擇年級 K~G6）
2. 孩子選擇技能 → 每次練習 **10 題**（參數化加減乘除、文字題、三種作答模式）
3. 作答即時回饋（正確綠色漣漪 / 錯誤晃動），可標記「家長協助」（不計入能力判斷）
4. 練習完成後系統依最近 5 題重算掌握度，觸發遊戲化機制
5. **規則式推薦**：正確率 < 40% 回前置技能 / ≥ 95% 晉級 / 中間保持
6. **升學測試**：年級全部技能掌握後可挑戰升學，正確率 ≥ 80% 晉級

### 三種作答模式

| 模式 | 說明 |
| --- | --- |
| `choice` | 四選一選擇題，支援鍵盤 1-4 快選 |
| `fillin` | 虛擬數字鍵盤輸入（最多 3 位數） |
| `numberline` | 數字線點選整數作答 |

### 遊戲化機制

- ⭐ **星星**：每答對一題（非 assisted）= 1 星
- 🔥 **連續練習**：時區安全（Asia/Taipei），中斷重置
- 🏅 **成就徽章**：9 種（首次、全對、連擊 5/10/25、速度連段、加法/減法達人、全技能掌握、連續 7 天、練習 5 次、升學之星）

## 認證模型（三種獨立 Session）

| 類型 | Cookie | 過期 | 說明 |
| --- | --- | --- | --- |
| 家長 | `math-session` | 7 天 | JWT，含 `tokenVersion`，角色變更即時失效（admin 等敏感操作經 `getVerifiedSession()` 查 DB 驗證） |
| 孩子（家長建檔） | `math-child` | 2 小時 | 依 childId 存取，免帳密 |
| 學生自助 | `math-child` | 2 小時 | Email + 驗證碼（OTP）登入，可事後申請綁定家長（須家長確認） |

## 專案結構

```text
src/
├── proxy.ts              # 路由守衛（非 middleware.ts）
├── actions/              # Server Actions
│   ├── auth.ts           # 家長註冊/登入（雙步驟 CAPTCHA + OTP）
│   ├── student-auth.ts   # 學生自助註冊/登入
│   ├── child-auth.ts     # 孩子 session 管理
│   ├── practice.ts       # 練習核心（startSession / submitAnswer）
│   ├── admin.ts          # Admin CRUD（技能/題目）
│   ├── reports.ts        # 家長報表/錯題本/成長報告
│   └── achievement.ts    # 徽章進度查詢
├── app/                  # App Router 頁面
│   ├── admin/            # 管理後台
│   ├── children/         # 孩子學習概覽
│   ├── dashboard/        # 家長儀表板
│   ├── login|signup/     # 家長認證
│   ├── practice/         # 學生做題
│   ├── student/          # 學生自助認證
│   └── api/              # Route Handlers（非 Server Actions）
│       ├── cron/cleanup/ # Cron 排程：清理過期 OTP / 臨時認證資料
│       └── export/       # CSV 匯出（admin 全表 / child 單一孩子）
├── components/           # React 元件
├── lib/                  # 核心邏輯
│   ├── prisma.ts         # PrismaClient 單例（含 driver adapter）
│   ├── session.ts        # 家長 JWT cookie
│   ├── child-session.ts  # 孩子 session cookie
│   ├── captcha.ts|otp.ts|email.ts  # 雙因素認證
│   ├── question.ts       # 題目生成（DIRECT/ADD/SUB/MUL/DIV/WORD_PROBLEM）
│   ├── mastery.ts        # 掌握度 + 規則式推薦
│   ├── gamification.ts   # 星星/連續/徽章
│   ├── grade.ts          # 年級順序/權限
│   ├── answer-i18n.ts    # 中英文答案等價驗證
│   └── csv.ts|export-data.ts  # CSV 匯出
prisma/
├── schema.prisma         # 資料模型（10 核心表 + 4 認證/安全輔助表 = 14 表）
├── migrations/           # Prisma migration 紀錄（正式環境用 migrate deploy 套用）
└── seed.ts               # 種子資料
prisma.config.ts          # CLI 連線字串（位於 repo root，非 prisma/ 下）
vitest.config.ts          # 單元測試設定
```

## 開發指令

| 指令 | 用途 |
| --- | --- |
| `npm run dev` | 啟動開發伺服器 |
| `npm run build` | 正式建置 |
| `npm run lint` | ESLint 檢查 |
| `npm run typecheck` | TypeScript 型別檢查（`tsc --noEmit`） |
| `npm run test` | 單元測試（vitest，覆蓋 grade.ts / answer-i18n.ts 等純邏輯） |
| `npm run db:push` | 同步 schema 到 PostgreSQL（開發用，不留 migration 紀錄） |
| `npm run db:migrate:dev` | 開發用：同步 schema 並建立 migration 紀錄 |
| `npm run db:migrate:deploy` | **正式用**：套用所有 pending migration（不互動、可重複執行） |
| `npm run db:migrate:status` | 查詢 migration 套用狀態 |
| `npm run db:bootstrap` | ⚠️ **破壞性**：清空學習資料並重建題庫（需全新 DB） |
| `npm run db:seed` | 非破壞性填入種子資料（偵測到作答紀錄會跳過重建） |
| `npm run db:content:sync` | 非破壞性：只 upsert 技能與題目（= `db:seed`） |
| `npm run admin:bootstrap` | 安全建立 / 重設管理員帳號（不影響學習資料） |
| `npm run db:seed:demo` | 填入示範資料 |
| `npm run db:clean:demo` | 清除示範資料 |
| `npm run db:seed:challenge` | 填入挑戰題（升學測驗） |
| `npm run cleanup:auth` | 手動清理過期臨時認證資料（同 cron 端點） |

## 部署（正式環境）

### 1. 環境變數

| 變數 | 必填 | 說明 |
| --- | --- | --- |
| `SESSION_SECRET` | ✅ | JWT 金鑰，強隨機字串（`openssl rand -base64 32`），嚴禁使用預設值 |
| `DATABASE_URL` | ✅ | PostgreSQL 連線字串（Supabase pooled，port 6543） |
| `DIRECT_URL` | 選填 | 給 migrate / db push 用的「非 pooled」連線（port 5432），無則退回 `DATABASE_URL` |
| `SMTP_HOST` / `SMTP_PORT` | ✅ | SMTP 伺服器（如 `smtp.gmail.com:465`） |
| `SMTP_USER` / `SMTP_PASS` | ✅ | Gmail App Password 或專業郵件服務憑證（OTP 寄信用） |
| `ADMIN_EMAIL` | ✅ | 管理員帳號 Email，**必須是可收 OTP 的真實信箱**（seed 在正式環境會強制檢查） |
| `ADMIN_PASSWORD` | ✅ | 管理員密碼（至少 8 碼，不可為 `admin123`）；未設定會自動產生隨機密碼並印在終端 |
| `ALLOW_DESTRUCTIVE_SEED` | ❌ | 設為 `true` 才允許 seed 清空學習資料（正式環境請勿設定） |
| `CRON_SECRET` | 選填 | 保護 `/api/cron/cleanup` 端點的共用密鑰 |

### 2. 資料庫 migration（正式環境請勿用 db:push）

```bash
# 套用所有 pending migration（冪等、可重複執行、CI/CD 友善）
npm run db:migrate:deploy

# 確認套用狀態
npm run db:migrate:status

# 補題庫（非破壞性，不會清空既有學習資料）
npm run db:content:sync

# 建立管理員帳號（首次部署）
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=your-strong-password npm run admin:bootstrap
```

> **為何不用 `db:push`？** `db:push` 直接對齊 schema 但不留 migration 紀錄，無法追蹤變更歷史，也不保證多環境一致。正式環境請一律用 `db:migrate:deploy` 套用 `prisma/migrations/` 下的 migration。

### 3. 其他

- **資料庫**：正式環境使用 PostgreSQL（本專案使用 Supabase）
- **Email**：建議使用 Gmail App Password 或 Resend 等專業服務
- **Cron 清理**：定期呼叫 `/api/cron/cleanup`（Vercel Cron / 外部排程器）清理過期 OTP 與臨時認證資料
