<!-- markdownlint-disable-file MD025 -->
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# 數學小達人 — 專案導覽（AI 必讀）

> 這份檔案每次對話自動載入。目的是讓 AI 不必重讀整個 codebase 就能動手。
> 詳細系統文件見 `docs/K6-math-platform-plan.md`；規劃/任務清單見 `docs/`。

## 一句話定位
K-2 數學學習平台（Next.js 16 App Router + Prisma 7 + PostgreSQL）。家長建檔、孩子做題、遊戲化（星星/連續/徽章）、規則式掌握度推薦、Admin 後台。

## 技術棧與硬性規定
- **Next.js 16 App Router** + React 19 + Tailwind v4（`@import "tailwindcss"`）
- **Prisma 7**（driver adapter 模式，**不是** Rust engine）：
  - `datasource` 區塊**不可寫 `url`**，連線字串在 `prisma.config.ts`
  - `PrismaClient` 必須傳入 driver adapter，見 `src/lib/prisma.ts`
  - Generator 輸出到 `src/generated/prisma`（已 gitignore），匯入用 `@/generated/prisma`（**不是** `@prisma/client`）
- **PostgreSQL**（Supabase），adapter 為 `@prisma/adapter-pg`
- 後端用 **Server Actions**（`src/actions/`），非 Route Handlers
- 表單驗證用 **zod**（`src/lib/definitions.ts`）
- 密碼 **bcryptjs**；Session/JWT 用 **jose**（HS256，httpOnly cookie）；Email OTP 用 **nodemailer**

## 關鍵指令

```bash
npm run dev          # 開發伺服器
npm run build        # 建置
npm run lint         # ESLint
npx prisma generate  # 重新生成 client（postinstall 也會跑）
npm run db:push      # 同步 schema 到 PostgreSQL
npm run db:seed      # 種子資料（admin + 7 技能 + 題目）
npx tsc --noEmit     # 確認真實 TS 狀態（get_errors 可能有 cache）
```

## 目錄結構（最重要）

```text
src/
├─ proxy.ts                    # middleware（路由守衛：parent/admin/child session）
├─ app/
│  ├─ page.tsx                 # 首頁
│  ├─ login/ signup/           # 家長登入/註冊（雙步驟：CAPTCHA + OTP）
│  ├─ dashboard/               # 家長儀表板
│  ├─ children/[childId]/      # 孩子檔案 / 練習入口（家長建檔模式）
│  ├─ practice/[childId]/      # 學生做題頁（核心）
│  ├─ child-login/             # 孩子帳密登入
│  ├─ student/login/ signup/   # 學生自助註冊/登入
│  └─ admin/                   # 管理後台：skills / questions / attempts
├─ actions/                    # Server Actions
│  ├─ auth.ts                  # 家長註冊/登入/登出（雙步驟）
│  ├─ child-auth.ts            # 家長建檔孩子的 session
│  ├─ student-auth.ts          # 學生自助註冊/登入/linkParent
│  ├─ practice.ts              # startSession / submitAnswer（含遊戲化）
│  └─ admin.ts                 # Admin CRUD
├─ lib/
│  ├─ prisma.ts                # PrismaClient 單例（帶 adapter）
│  ├─ session.ts               # 家長 JWT cookie
│  ├─ child-session.ts         # 孩子 session cookie
│  ├─ captcha.ts / otp.ts / email.ts  # 雙因素認證零件
│  ├─ definitions.ts           # zod schemas
│  ├─ question.ts              # 題目生成（DIRECT/ADD/SUB/WORD_PROBLEM，含 MUL/DIV）
│  ├─ mastery.ts               # 掌握度 + getRecommendation（規則式）
│  └─ gamification.ts          # updateStars / updateStreak / checkBadges
└─ components/                 # number-pad / number-line / practice-client / 表單等
```

## 認證模型（容易搞錯，務必注意）
- **三種獨立 session**：家長（JWT）、孩子（家長建檔模式，依 childId）、學生（自助帳密 + PIN）
- 答案在 `submitAnswer` 時**從伺服器重算正確答案**，不信任前端
- `assisted=true` 的作答只給家長看，**不計入**正確數、掌握度、推薦、星星

## 資料模型（9 表）
`User`(家長/ADMIN) · `ChildProfile`(stars/streak/mode/pin?) · `ParentChild` · `Skill`(prerequisiteId 自關聯) · `QuestionTemplate`(paramsJson) · `PracticeSession`(questionsJson 伺服器快照) · `Attempt` · `MasterySnapshot` · `Badge`/`ChildBadge`。
完整 schema 見 `prisma/schema.prisma`。

## 遊戲化（詳見 repo memory 或 gamification.ts）
答對非 assisted = 1 星；練習完成時 updateStars + updateStreak + checkBadges。徽章 9 種（見 seed）。

## 工作慣例
- 中文介面；註解可用中文
- 路由守衛在 `src/proxy.ts`（非 `middleware.ts`）
- 規劃文件統一放 `docs/`（如 `docs/CHECKLIST-G2-*.md`、`docs/K6-math-platform-plan.md`）
