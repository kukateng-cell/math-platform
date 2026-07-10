# 數學小達人 | K-G6 數學練習平台

K-G6 數學學習平台。家長建立孩子檔案，孩子做題，系統記錄表現並給出規則式下一步推薦。涵蓋從數數到分數乘除法的完整學習路徑，具備遊戲化激勵機制（星星、連續練習、成就徽章）和管理後台。

## 技術棧

- **Next.js 16**（App Router）+ TypeScript
- **React 19** + **Tailwind CSS v4**（`@import "tailwindcss"`）
- **Prisma 7**（driver adapter 模式）+ **PostgreSQL**（Supabase）
- **Server Actions**（非 Route Handlers）
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
npm run db:push
npm run db:bootstrap

# 3b. 既有 DB（已有學習資料）：僅同步題庫（不刪除既有作答/掌握度）
npm run db:push
npm run db:content:sync

# 4. 啟動開發伺服器
npm run dev
```

> **⚠️ 安全注意**：`db:seed` 和 `db:bootstrap` 會清除所有學習資料（作答、session、掌握度），僅適合全新資料庫。在已有正式資料的環境請使用 `db:content:sync`（非破壞式，只 upsert 技能與題目）。`db:bootstrap` 需要設定 `ALLOW_DESTRUCTIVE_SEED=true` 環境變數。

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
│   └── student/          # 學生自助認證
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
├── schema.prisma         # 資料模型（9 表 + 2 輔助表）
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
| `npm run db:push` | 同步 schema 到 PostgreSQL |
| `npm run db:seed` | 填入種子資料 |
| `npm run db:seed:demo` | 填入示範資料 |
| `npm run db:clean:demo` | 清除示範資料 |

## 部署注意事項

- **環境變數**：需設定 `SESSION_SECRET`、`DATABASE_URL`、`SMTP_HOST/PORT/USER/PASS`
- **資料庫**：正式環境建議使用 PostgreSQL（本專案使用 Supabase）
- **Session 金鑰**：`SESSION_SECRET` 必須為強隨機字串（`openssl rand -base64 32`），嚴禁使用預設值
- **Email**：建議使用 Gmail App Password 或 Resend 等專業服務
