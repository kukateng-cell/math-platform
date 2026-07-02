# 數學小達人（K-2 數學學習平台）系統文件

> 本文為本平台的「現況系統文件」，記錄目前實際實作的功能、技術架構與資料模型。
> K-6 全涵蓋、AI 自適應模型、B2B 校端、完整 CMS 仍是長期方向，但未放入目前版本。

> 📌 本版（v2）已大幅更新，使其與實際程式碼一致，並補齊原本文件缺少的：
> 學生自助註冊/登入、雙因素認證（CAPTCHA + OTP）、PIN 碼練習、遊戲化機制（星星/連續/徽章）、三種作答互動模式、規則式掌握度推薦，與完整的管理後台。

---

## 一、產品定位

第一版的核心目標：

**家長或學生能建立學習檔案，孩子完成一組低年級數學練習，系統記錄表現、給出下一步建議，並以遊戲化機制（星星、連續練習、徽章）維持學習動機。**

### 範圍（已實作）

| 項目 | 決策 |
| --- | --- |
| 目標年級 | K-2（K、G1、G2），從數感、加減法、文字題著手 |
| 市場模式 | B2C，家長端 + 學生自助端並存 |
| 使用者角色 | 家長、學生（可有獨立帳號）、管理員 |
| 核心流程 | 家長註冊/登入 → 建立孩子檔案 → 孩子做題 → 系統記錄 → 家長查看建議 |
| 學生自助 | 學生可自行註冊/登入（帳密 + PIN），事後可綁定家長 |
| 自適應 | 規則式掌握度與推薦，不做機器學習 |
| 遊戲化 | 星星、連續練習天數（streak）、成就徽章 |
| 內容管理 | Admin 後台：技能、題目、作答紀錄的 CRUD 與查詢 |
| 認證安全 | 家長雙步驟登入（CAPTCHA + Email OTP）、學生 PIN、登入限速 |

### 非目標（仍未做）

* BKT／DKT／IRT 等 AI 或心理計量模型
* B2B 學校批次匯入、班級、教師端
* 完整拖曳式知識樹 CMS
* PWA 離線題庫與音檔快取
* Pixi.js 重動畫遊戲化
* 自動 TTS 生成與人工審核管線
* Elasticsearch、Prometheus、Grafana
* 政府證件比對等自建家長同意驗證流程

---

## 二、核心學習閉環

### 1. 建立學習檔案（兩種途徑）

**途徑 A — 家長建立孩子檔案（STANDARD 模式）**
家長用 Email 註冊後，可建立一個或多個孩子檔案：

* 暱稱
* 年級（K / G1 / G2）
* （家長建立的檔案可不需獨立帳密，孩子在 `/children/{childId}` 直接進入練習）

**途徑 B — 學生自助註冊（SELF_STUDY / 帶帳密 STANDARD）**
學生可在 `/student/signup` 自行註冊，建立**擁有獨立帳號**的檔案：

* Email + 密碼 + 暱稱 + 年級 + 4 位數 PIN 碼
* 註冊後直接建立 `ChildProfile`（`mode` 依流程而定），並以 child session 登入進入練習
* 事後可透過「綁定家長」功能（`linkParent`），用家長 Email 建立關聯（`ParentChild` 表）

> 學生第一版即可擁有獨立帳號與密碼，讓較大的孩子能自己登入做題；家長也能在後台幫孩子註冊一個帶帳密的學生帳號（`parentRegisterStudent`）。

### 2. 學生做題

學生進入指定技能後，每次練習 **10 題**（`QUESTIONS_PER_SESSION = 10`）。題目涵蓋低年級可驗證範圍：

* 數數與圖形辨認（直接題目 / 選擇題）
* 數量比較
* 10 以內加法 / 20 以內加法
* 10 以內減法
* 簡單生活情境文字題

**三種作答互動模式**（由題目 `paramsJson.interaction` 決定）：

| 模式 | 說明 | 元件 |
| --- | --- | --- |
| `choice` | 四選一選擇題，支援數字鍵 1-4 快選 | 內建選項按鈕 |
| `fillin` | 填答題，虛擬數字鍵盤輸入（最多 3 位數） | `NumberPad` |
| `numberline` | 數字線點選作答（指定範圍內選整數） | `NumberLine` |

作答回饋包含即時動畫（正確綠色漣漪+縮放 / 錯誤晃動）、計時器、進度圓點（詳見第六節）。

### 3. 系統記錄表現

每次練習保存於 `PracticeSession` 與 `Attempt`：

* 練習開始與完成時間
* 每題：題目快照、答案、是否正確、作答用時、是否家長協助
* 伺服器生成題目快照（`questionsJson`），`submitAnswer` 時**從伺服器重算正確答案**，不信任前端

**家長協助（陪伴模式）**：作答可標記 `assisted=true`，不計入能力判斷與正確數，但會保留紀錄供家長查看。

### 4. 下一步推薦（規則式）

用簡單、可解釋的規則（`getRecommendation`），依「最近 5 題非 assisted」的掌握度（`masteryLevel`）判斷：

* 所有技能未練過 → 從第一個技能開始
* 正確率過低（< 40%，且樣本 ≥ 5）且有前置技能 → 回前置技能（`PRACTICE_PREREQ`）
* 連續答對、正確率 ≥ 95% → 推進到下一個技能（`ADVANCE` / `KEEP`）
* 正確率 60%-95% → 保持當前技能多練一組（`KEEP`）
* 全部技能掌握 → `ALL_DONE`
* `assisted=true` 的作答只顯示給家長，不用於推薦與掌握度計算

### 5. 遊戲化回饋（每次練習完成觸發）

練習完成後於 `submitAnswer` 中執行（`src/lib/gamification.ts`）：

* **星星**：每答對一題（非 assisted）= 1 顆星，累加到 `ChildProfile.stars`
* **連續練習天數（streak）**：依 `lastPracticeAt` 計算，中斷則重置為 1
* **成就徽章**：依條件檢查並授予（詳見第八節）

---

## 三、技術方案

### 技術棧（實際採用）

| 領域 | 選型 |
| --- | --- |
| Web 框架 | Next.js 16（App Router）+ TypeScript |
| UI | React 19 + Tailwind CSS v4（`@import "tailwindcss"`） |
| 資料庫 | **SQLite**（`better-sqlite3`）；開發/小規模用 SQLite，日後可換 PostgreSQL |
| ORM | **Prisma 7**（driver adapter 模式，`@prisma/adapter-better-sqlite3`） |
| 後端 | Next.js **Server Actions**（非 Route Handlers） |
| 表單驗證 | **zod**（`src/lib/definitions.ts`） |
| 密碼雜湊 | **bcryptjs** |
| Session / JWT | **jose**（HS256 JWT 存於 httpOnly cookie） |
| Email | **nodemailer**（OTP 寄送） |
| 認證 | 家長雙步驟（CAPTCHA + OTP）；學生帳密 + PIN；學生 session 獨立 cookie |
| 部署 | 單一 Web app + 隨附 SQLite 檔（日後可改管理式資料庫） |
| 錯誤追蹤 | 上線前接 Sentry；不建自有監控平台 |

### Prisma 7 注意事項

* `datasource` 區塊**不寫 `url`**，連線字串改放 `prisma.config.ts`
* runtime `PrismaClient` 必須傳入 driver adapter（見 `src/lib/prisma.ts`）
* Generator 輸出到 `src/generated/prisma`，匯入為 `@/generated/prisma`

### 暫不採用

| 原計劃項目 | 延後原因 |
| --- | --- |
| NestJS 獨立後端 | MVP 邏輯量不值得拆服務 |
| Redis / BullMQ | 暫無大量背景任務 |
| Elasticsearch | 題庫量不足前，資料庫查詢足夠 |
| Prometheus / Grafana | 初期用平台監控與 Sentry 即可 |
| Pixi.js | 先避免低階平板效能風險 |
| PWA 離線 | 離線同步會增加資料一致性與隱私成本 |

---

## 四、資料模型

完整 9 張資料表（見 `prisma/schema.prisma`）：

| 資料表 | 用途 | 重點欄位 |
| --- | --- | --- |
| `User` | 家長與管理員帳號 | `email`、`passwordHash`、`role`(PARENT/ADMIN) |
| `ChildProfile` | 孩子檔案（可有獨立帳號） | `email?`、`passwordHash?`、`pin?`(4位)、`nickname`、`gradeLevel`、`mode`、`stars`、`streak`、`lastPracticeAt`、`parentId?` |
| `ParentChild` | 親子多對多綁定（學生可綁多個家長） | `parentId`、`childId`，`@@unique([parentId, childId])` |
| `Skill` | 學習技能 | `code`、`gradeLevel`、`order`、`prerequisiteId`(自關聯前置技能)、`isActive` |
| `QuestionTemplate` | 題目模板 | `type`、`prompt`、`paramsJson`、`answer`、`options`、`explanation` |
| `PracticeSession` | 一次練習 | `totalQuestions`、`correctCount`、`questionsJson`(伺服器快照)、`completedAt` |
| `Attempt` | 單題作答紀錄 | `questionPrompt`(快照)、`userAnswer`、`correctAnswer`、`isCorrect`、`assisted`、`durationMs` |
| `MasterySnapshot` | 掌握度快照 | `recentCorrect`、`recentTotal`、`masteryLevel`(0-1)，`@@unique([childId, skillId])` |
| `Badge` / `ChildBadge` | 成就徽章定義與授予 | `code`(unique)、`name`、`icon`、`condition`；`ChildBadge` `@@unique([childId, badgeId])` |

### 列舉（enum）

* `Role`：`PARENT` / `ADMIN`
* `ChildMode`：`STANDARD`（需 PIN，可綁家長）/ `SELF_STUDY`（免 PIN，用驗證碼登入，自主學習）
* `QuestionType`：`DIRECT`（直接題目）/ `ADD`（參數化加法）/ `SUB`（參數化減法）/ `WORD_PROBLEM`（參數化文字題）

### 技能層級

固定為 **年級 -> 技能**（K / G1 / G2），技能間以 `prerequisiteId` 單向鏈結，不做無限層級樹。

### Seed 內容（`prisma/seed.ts`）

* 1 個 admin 帳號
* 7 個技能：數數、圖形辨認、數量比較、10 以內加法、10 以內減法、20 以內加法、簡單文字題
* 各技能對應的 `QuestionTemplate`

---

## 五、內容與題庫

### 題庫策略

少量高品質內容，不追求海量題庫：題目可停用（`isActive`），不直接刪除；每題可附簡短解析（`explanation`）

### 四種題目類型（`QuestionType`）

| 類型 | 說明 |
| --- | --- |
| `DIRECT` | 直接題目，固定 prompt / answer / options |
| `ADD` | 參數化加法：`{aMin,aMax,bMin,bMax,sumMax}` 抽運算元，保證和不超限 |
| `SUB` | 參數化減法：抽運算元，保證差不為負 |
| `WORD_PROBLEM` | 參數化生活情境文字題：`{operation:'add' 或 'sub', ...範圍}` |

題目實例由 `src/lib/question.ts` 的 `generateQuestion` 在伺服器產生，並打亂選項順序（`shuffle`）

### 作答互動（`paramsJson.interaction`）

| 互動 | 說明 |
| --- | --- |
| `choice` | 選擇題（預設當 `options` 非空時） |
| `fillin` | 填答題，虛擬鍵盤 |
| `numberline` | 數字線，需 `rangeMin` / `rangeMax` |

### 管理員功能（Admin 後台）

* 技能管理：新增、編輯、啟停（含前置技能選擇）
* 題目管理：新增、搜尋/篩選、分頁、預覽、啟停
* 作答紀錄查詢：最近 attempts 表（含是否 assisted、正確答案）

> 完整 CMS 權限分工、審核流程、媒體管理員與數據分析師角色延後。

---

## 六、使用者介面與路由

### 路由樹（實際）

```text
/                         首頁（依登入狀態顯示入口）
/login                    家長登入（CAPTCHA → OTP 雙步驟）
/signup                   家長註冊（含 CAPTCHA）
/dashboard                家長：孩子列表 + 新增孩子表單
/children/[childId]       家長：單一孩子學習概覽
/practice/[childId]       家長/孩子：技能選單 + 推薦
/practice/[childId]/[skillId]/[sessionId]  做題頁（PracticeClient）
/student/login            學生登入（帳密 + PIN）
/student/signup           學生自助註冊
/child-login              孩子練習登入（PIN）
/admin                    管理後台首頁
/admin/skills             技能管理
/admin/questions          題目管理
/admin/attempts           作答紀錄查詢
```

### 學生做題頁（`PracticeClient`）

* 每次只呈現一個學習焦點
* 支援鍵盤（1-4 快選、Enter 送出/下一題）、滑鼠與觸控
* **動畫回饋**：正確綠色漣漪+縮放、錯誤晃動、背景閃爍、正確答案延遲突出
* **計時器**：`⏱️ MM:SS` 每秒更新，完成頁顯示總時間
* **進度條**：藍紫漸層 + 百分比 + 平滑過渡
* **進度圓點**：10 個狀態指示器（✅ / ❌ / 🤝 / 當前脈動 / 未完成）
* **完成結果頁**：動態鼓勵訊息、正確率進度條、每題結果一覽、星星灑落動畫
* 提供「減少動畫」模式（`ReducedMotionToggle`，localStorage 持久化）

### 家長端頁面

* 孩子列表（`/dashboard`）：星星、連續天數、最近練習結果、PIN 管理、刪除
* 學習概覽（`/children/[childId]`）：掌握度卡片（已掌握/練習中/需加強）、徽章、最近練習紀錄表、推薦區
* 系統直接推薦今日練習，家長可接受、略過或更換（不做「接任務再派發」雙步流程）

### 管理端頁面

* 技能管理、題目管理、作答紀錄查詢
* 管理端查閱兒童資料最小化：預設只顯示暱稱、年級、學習資料

---

## 七、使用者角色與認證流程

### 三種角色

| 角色 | 登入方式 | Session |
| --- | --- | --- |
| 家長（PARENT） | Email + 密碼 + CAPTCHA + **Email OTP 雙步驟** | `math-session` cookie（7 天） |
| 學生（CHILD） | Email + 密碼 + **PIN 碼**（STANDARD）；或驗證碼（SELF_STUDY） | `math-child` cookie（2 小時，僅限練習路由） |
| 管理員（ADMIN） | 同家長雙步驟流程，`role=ADMIN` | `math-session` cookie |

### 家長雙步驟登入（`src/actions/auth.ts` + `src/lib/otp.ts`)

1. **Step 1**：驗證帳密 + **數學 CAPTCHA**（`src/lib/captcha.ts`，加減法 challenge，JWT 簽名 5 分鐘） → 產生 6 位數 OTP，以 nodemailer 寄 Email，並回傳 `tempToken`（10 分鐘）
2. **Step 2**：用 `tempToken` + OTP 驗證 → 建立 session
3. **限速**：同一 Email 60 秒內最多 5 次嘗試；OTP 60 秒冷卻重發；OTP 5 分鐘過期、一次性

### 學生流程（`src/actions/student-auth.ts` + `src/lib/child-session.ts`)

* 註冊：Email + 密碼 + 暱稱 + 年級 + 4 位 PIN（PIN 全域唯一）
* 登入：帳密 + PIN → child session（`getChildSession`，無法存取家長端）
* 綁定家長：`linkParent` 用家長 Email 建立 `ParentChild` 關聯
* 家長也可在後台幫孩子註冊帶帳密學生（`parentRegisterStudent`）

### 密碼安全

* bcrypt 雜湊（cost 10）
* httpOnly、sameSite=lax cookie
* 開發模式下 OTP 直接顯示於前端（正式環境關閉）

---

## 八、遊戲化機制

### 星星（`stars`)

* 每答對一題（非 assisted）= 1 顆星
* 練習完成時查詢 session 所有 attempts 計算後累加（`updateStars`)

### 連續練習天數（`streak`)

* 依 `lastPracticeAt` 計算：間隔 1 天 +1、間隔 0 天不變、間隔 >1 天重置為 1（`updateStreak`)

### 成就徽章（`Badge` / `ChildBadge`)

`checkBadges` 於練習完成時檢查並授予：

| code | icon | 條件 |
| --- | --- | --- |
| `first-practice` | 🌟 | 完成首次練習 |
| `streak-7` | 🔥 | 連續 7 天 |
| `streak-14` | 💪 | 連續 14 天 |
| `streak-30` | 🏆 | 連續 30 天 |
| `stars-50` | ⭐ | 累計 50 星 |
| `stars-100` | ⭐⭐ | 累計 100 星 |
| `perfect-score` | 🎯 | 一次全對 |
| `all-skills` | 📚 | 所有技能都練過 |
| `addition-master` | 🧮 | 加法正確率 ≥ 90% |

### 掌握度與推薦（`src/lib/mastery.ts`)

* `updateMastery`：練習完成後以最近 5 題（非 assisted）重算 `masteryLevel`（0-1）
* `getRecommendation`：規則式推薦（見二、4）

---

## 九、隱私、合規與安全

本節不是法律意見；正式上線前需法律顧問確認目標市場要求。

已實作：

* 孩子資料只收集學習必要資訊（暱稱、年級、作答紀錄）
* 不接廣告追蹤、不出售資料、不做社交功能
* 家長可以查看、刪除孩子檔案（`delete-child-button`）
* 密碼 bcrypt 雜湊、httpOnly cookie
* 登入限速 + CAPTCHA + OTP 防暴力破解
* 越權防護：所有 action 皆驗證 session 歸屬（家長只能存取自己的孩子、session）
* 已完成的練習不再接受作答（防重複提交）

仍待補：

* 家長建立孩子檔案前的資料收集說明（明確同意流程）
* 管理員敏感操作的 audit log
* COPPA 等兒童隱私合規（優先採成熟第三方流程，不自建 VPC）

---

## 十、開發時程與實際進度

> 原為 12 週規劃。以下標註各階段實際完成狀態。

### 第 1-2 週：產品骨架 ✅

* [x] 定義第一個學習單元與題型
* [x] 建立 Next.js 專案、資料庫、基本版型
* [x] 完成資料模型初版（含 ParentChild、Badge 等完整 9 表）

### 第 3-4 週：帳號與內容 ✅

* [x] 家長註冊與登入（含 CAPTCHA + OTP 雙步驟）
* [x] 孩子檔案（家長建立 + 學生自助註冊）
* [x] 管理員登入
* [x] 技能與題目 CRUD

### 第 5-6 週：做題閉環 ✅

* [x] 學生做題頁（choice / fillin / numberline 三種互動）
* [x] 練習結果頁
* [x] 作答紀錄
* [x] 掌握度與下一步推薦

### 第 7-8 週：家長與管理 ✅

* [x] 家長學習概覽（掌握度卡片、徽章、最近紀錄）
* [x] 弱項提示
* [x] 題目預覽與停用
* [x] `assisted=true` 陪伴模式

### 額外完成（計劃外推進）

* [x] 遊戲化：星星、連續天數、9 種成就徽章
* [x] 學生獨立帳號 + PIN 登入 + 綁定家長
* [x] A11Y：減少動畫模式、ARIA、鍵盤導航、焦點管理
* [x] 做題頁 UI 大改造：動畫回饋、計時器、進度圓點、結果頁強化

### 待辦

* [ ] 基本安全檢查、Sentry 接入
* [ ] 手機/平板測試、家庭內測
* [ ] 補足隱私說明與刪除流程
* [ ] 開放小規模 beta

---

## 十一、上線判斷標準

不要用「功能做完」判斷成功。第一版只看以下指標：

| 指標 | 目標 |
| --- | --- |
| 首次練習完成率 | >= 70% |
| 平均每次練習完成題數 | >= 8 題 |
| 家長能看懂學習紀錄 | 內測訪談中多數能說出孩子弱項 |
| 題目錯誤率異常 | 可由管理員快速停用問題題目 |
| 平板體驗 | 主流低階 Android 平板可順暢完成一輪練習 |

達不到這些指標時，不進入 AI、B2B 或大型 CMS。

---

## 十二、MVP 後路線圖

只有在 MVP 數據成立後，才進入下一階段：

1. 擴展到更多 K-2 單元
2. 加入更多互動教具
3. 加入雲端 TTS 或錄音素材
4. 做輕量內容審核流
5. 嘗試 B2B 小型學校試點
6. 累積足夠作答資料後，再評估 BKT、IRT 或其他模型

原則：先證明孩子願意做、家長看得懂、內容能維護，再談完整平台。

---

## 十三、A11Y 優化任務清單 ✅ 已完成

### Commit 1: 減少動畫 CSS + Toggle 組件

* [x] 1.1 `globals.css`: 新增 `.reduce-motion` 規則（停用所有 animation/transition）
* [x] 1.2 新建 `src/components/reduced-motion-toggle.tsx`：🌸/🌿 切換按鈕，localStorage 持久化

### Commit 2: Header + Layout 整合

* [x] 2.1 `header.tsx`: import ReducedMotionToggle，放入 nav
* [x] 2.2 `layout.tsx`: 加入 inline `<script>` 在 `<head>` 中讀取 localStorage 預先套用 class（防止閃爍）

### Commit 3: practice-client ARIA + 焦點管理

* [x] 3.1 題目區: `role="region"` + `aria-label="題目 {n}"`
* [x] 3.2 選項按鈕: `aria-pressed`
* [x] 3.3 進度條: `role="progressbar"` + `aria-valuenow` + `aria-valuemax`
* [x] 3.4 回饋訊息: `role="alert"`
* [x] 3.5 每題自動聚焦第一個選項（useRef + useEffect）
* [x] 3.6 完成頁自動聚焦「查看學習概覽」按鈕

### Commit 4: practice-client 鍵盤快捷鍵

* [x] 4.1 `onKeyDown`: 數字鍵 1-4 選擇對應選項
* [x] 4.2 `onKeyDown`: Enter 送出答案 / 下一題
* [x] 4.3 Tab 順序驗證：選項 → 送出 → 下一題

### Commit 5: Code Review 修正 (10 findings → 全部修正)

* [x] (H) Enter 重複觸發：加入 `submittingRef` guard
* [x] (M) 進度條 `aria-valuenow` off-by-one：改為 `index+1`，`aria-valuemin=1`
* [x] (M) 完成頁缺少自動聚焦：加入 `useEffect` 聚焦 completionLinkRef
* [x] (M) `useCallback` 依賴不完整：改用普通函數 + ref guard
* [x] (M) `localStorage` 無 try/catch：加入防禦性包裝
* [x] (L) 移除未使用的 `QuestionInstance` import
* [x] (L) 加入 `aria-keyshortcuts` 提示
* [x] (L) `button` 加入 `type="button"`
* [x] (L) CSS 補上 `animation-delay` / `transition-delay` / `scroll-behavior`

---

## 十四、做題頁 UI 大改造 ✅ 已完成

> 目標：讓做題過程更有趣、更直觀，提升 K-2 兒童參與度。動畫皆為非同步、不阻塞作答流程。

### Commit 1: `globals.css` 動畫 keyframes

* [x] 1.1 新增 `@keyframes shake`（錯誤晃動）
* [x] 1.2 新增 `@keyframes pop`（正確縮放）
* [x] 1.3 新增 `@keyframes fadeInUp`（結果訊息淡入）
* [x] 1.4 新增 `@keyframes ripple`（正確綠色漣漪）
* [x] 1.5 新增 `@keyframes flashGreen` / `flashRed`（背景閃爍 300ms）
* [x] 1.6 新增 `@keyframes pulseDot`（當前題目圓點脈動）
* [x] 1.7 對應工具類別 `.animate-*`（受既有 `.reduce-motion` 規則涵蓋）

### Commit 2: `practice-client.tsx` 作答即時動畫回饋

* [x] 2.1 新增 `feedback` 狀態（`correct` / `incorrect`）
* [x] 2.2 正確答案：選項觸發 `pop` + `ripple`，顯示 ✓，背景閃綠 300ms
* [x] 2.3 錯誤答案：選項觸發 `shake`，顯示 ✗，背景閃紅 300ms
* [x] 2.4 錯誤時正確答案按鈕延遲 500ms 後以綠色突出顯示（`revealCorrect` + fadeInUp）

### Commit 3: 練習計時器

* [x] 3.1 新增 `practiceStartRef`（練習開始時間，全場不重置）
* [x] 3.2 `useEffect` + `setInterval` 每秒更新 `elapsed`
* [x] 3.3 進度條旁顯示 `⏱️ MM:SS`（`font-mono`）
* [x] 3.4 完成頁顯示總花費時間（`共花費 ⏱️ MM:SS`，`finalTotalMs`）

### Commit 4: 進度條視覺強化

* [x] 4.1 進度條保留藍紫漸層 + `transition-all duration-500`
* [x] 4.2 進度條上方顯示完成百分比
* [x] 4.3 進度條下方新增 10 個狀態圓點
  * [x] 已完成正確：綠色 ✓
  * [x] 已完成錯誤：紅色 ✗
  * [x] 家長協助：琥珀色 🤝
  * [x] 當前題目：藍色脈動
  * [x] 未完成：灰色空心 ○

### Commit 5: 完成結果頁強化

* [x] 5.1 依正確率動態鼓勵訊息（100% 🏆 / ≥80% 🌟 / ≥60% 💪 / <60% 🌱）
* [x] 5.2 顯示總花費時間
* [x] 5.3 新增綠色漸層正確率進度條
* [x] 5.4 新增每題結果一覽清單（✅ / ❌ + 正確答案 / 🤝 家長協助）
* [x] 5.5 新增 `QuestionResult` 型別，記錄每題 `correct` / `assisted` / `correctAnswer` / `userAnswer`

### 驗收標準對照

| 驗收項目 | 狀態 |
| --- | --- |
| 正確答案觸發綠色動畫回饋（漣漪 + 縮放） | ✅ |
| 錯誤答案觸發晃動動畫，正確答案延遲突出 | ✅ |
| 右上角顯示 ⏱️ 計時器，每秒更新 | ✅ |
| 完成頁顯示總花費時間 | ✅ |
| 進度條藍紫漸層 + 平滑過渡 | ✅ |
| 進度條下方 10 個圓點狀態指示器 | ✅ |
| 完成頁依正確率顯示動態鼓勵訊息 | ✅ |
| 完成頁有每題結果一覽清單 | ✅ |
| 動畫非同步、不阻塞作答 | ✅ |
| `npx tsc --noEmit` 通過（僅剩既有 `nodemailer` 型別無關錯誤） | ✅ |

### 受影響檔案

* `src/app/globals.css` — 新增 7 個 `@keyframes` + 對應工具類別
* `src/components/practice-client.tsx` — 新增狀態、計時器、動畫回饋、進度圓點、結果頁強化
