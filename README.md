# 數學小達人 | K-2 數學練習平台

K-2 零基礎數學學習平台 MVP。家長建立孩子檔案，孩子做題，系統記錄表現並給出規則式下一步建議。

## 技術棧

- **Next.js 16**（App Router + Turbopack）+ TypeScript
- **Tailwind CSS v4**
- **Prisma 7** + SQLite（driver adapter 模式）
- **jose + bcryptjs** 自管 session（取代 Auth.js，避免 Next.js 16 middleware→proxy 相容問題）
- **Zod** 表單驗證

## 快速開始

```bash
# 1. 安裝依賴（會自動 prisma generate）
npm install

# 2. 設定環境變數（.env 已含本機用的 SESSION_SECRET，正式環境請換新）
openssl rand -base64 32   # 產生新密鑰

# 3. 建立資料庫 schema
npm run db:push

# 4. 填入種子資料（管理員帳號 + 技能 + 題目）
npm run db:seed

# 5. 啟動開發伺服器
npm run dev
```

打開 http://localhost:3000

## 預設帳號

| 角色 | Email | 密碼 |
| --- | --- | --- |
| 管理員 | admin@math.local | admin123 |

家長帳號請自行註冊。

## 核心流程

1. 家長註冊 → 建立孩子檔案（K / G1 / G2）
2. 孩子選擇技能 → 每次練習 10 題（含參數化加減法）
3. 作答即時回饋，可標記「家長協助」（不計入能力判斷）
4. 練習完成後系統依最近 5 題重算掌握度
5. 規則式推薦：正確率 < 40% 回前置技能 / 100% 晉級 / 中間保持

## 專案結構

```
src/
├── actions/          # Server Actions（auth / practice / admin）
├── app/              # App Router 頁面
│   ├── admin/        # 管理端
│   ├── children/     # 家長學習概覽
│   ├── dashboard/    # 家長孩子列表
│   ├── login|signup/ # 認證頁
│   └── practice/     # 學生做題
├── components/       # React 元件
├── lib/              # prisma / session / mastery / question / definitions
└── proxy.ts          # 路由保護（Next.js 16 middleware → proxy）
prisma/
├── schema.prisma     # 資料模型（datasource 不含 url，Prisma 7 規範）
├── prisma.config.ts  # CLI 連線字串（Prisma 7 規範）
└── seed.ts           # 種子資料
```

## 開發指令

| 指令 | 用途 |
| --- | --- |
| `npm run dev` | 啟動開發伺服器 |
| `npm run build` | 正式建置 |
| `npm run db:push` | 同步 schema 到 SQLite |
| `npm run db:seed` | 填入種子資料 |
