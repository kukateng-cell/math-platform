# G2 乘法與除法擴展 — 任務清單

> 本清單分為 3 個 Commit，每完成一個 Commit 需經過 subagent code review 後方可繼續。

---

## Commit 1：Schema 擴充 + MUL/DIV 題型生成邏輯 + 管理表單

### 1.1 Prisma Schema — QuestionType enum
- [ ] `prisma/schema.prisma`：在 `enum QuestionType` 中新增 `MUL` 和 `DIV`

### 1.2 題目生成邏輯 — `src/lib/question.ts`
- [ ] `RawTemplate` type 新增 `'MUL' | 'DIV'`
- [ ] `generateQuestion()` 新增 `MUL` 分支：
  - 從 paramsJson 讀取 `aMin/aMax/bMin/bMax`
  - 隨機生成 `a × b = answer`
  - `_a`, `_b` 存入回傳值供伺服器驗證
  - 產生干擾項：`answer ± a`, `answer ± b` 和附近其他整數
- [ ] `generateQuestion()` 新增 `DIV` 分支：
  - 從 paramsJson 讀取 `aMin/aMax/bMin/bMax`
  - 保證 `a % b === 0`（整除）
  - 若 `aMultipleOfB: true`，先生成 b 再生成 a 為 b 的倍數
  - 否則隨機生成 a, b，若無法整除則重新選擇
  - 產生干擾項：`answer ± 1`, `answer ± b` 等
- [ ] `WORD_PROBLEM` 擴充：支援 `operation: 'mul' | 'div'`
  - `mul`：a × b，確保 answer 在合理範圍
  - `div`：a ÷ b，確保整除

### 1.3 管理表單 — `src/components/admin/question-form.tsx`
- [ ] 題型下拉選單新增 `MUL`（參數化乘法）和 `DIV`（參數化除法）
- [ ] Edit 模式顯示正確的題型名稱（含 MUL/DIV）

---

## Commit 2：Seed 資料 — 5 個新技能 + 大量題庫

### 2.1 新技能建立
- [ ] `intro-multiply`（乘法入門, G2, 前置: add-within-20, order: 7）
- [ ] `multiply-6-9`（6-9 的乘法, G2, 前置: intro-multiply, order: 8）
- [ ] `multiply-table`（九九乘法練習, G2, 前置: multiply-6-9, order: 9）
- [ ] `intro-divide`（除法入門, G2, 前置: intro-multiply, order: 10）
- [ ] `divide-basic`（基礎除法, G2, 前置: intro-divide, order: 11）

### 2.2 乘法入門題目（目標 ≥ 30 題）
- [ ] MUL 參數化模板：`{a} × {b} = ?`（aMin:2, aMax:5, bMin:2, bMax:5）
- [ ] MUL 參數化模板：`{a} × {b} = ?`（連加引導版，含 explanation）
- [ ] DIRECT 連加題：`3 + 3 + 3 + 3 = ?` → 引導 `4 × 3`
- [ ] DIRECT 連加題：`5 × 2 = ?` → `5 + 5 = 10`
- [ ] DIRECT 概念題：`4 個 3 相加是多少？`

### 2.3 6-9 乘法題目（目標 ≥ 30 題）
- [ ] MUL 參數化模板 × 3（不同範圍 aMin:6, aMax:9, bMin:1 到 bMax:9）
- [ ] DIRECT 精選題（如 6×7, 7×8, 9×6 等常見易錯題）

### 2.4 九九乘法練習題目（目標 ≥ 40 題）
- [ ] MUL 參數化模板 × 4（全範圍：aMin:2, aMax:9, bMin:2, bMax:9）
- [ ] 確保涵蓋 2×2 到 9×9 完整範圍

### 2.5 除法入門題目（目標 ≥ 25 題）
- [ ] DIV 參數化模板：`{a} ÷ {b} = ?`（aMin:4, aMax:30, bMin:2, bMax:5, aMultipleOfB:true）
- [ ] DIRECT 平分文字題：把 N 個物品平分給 M 個人
- [ ] DIRECT 概念題：`10 ÷ 2 = ?` → `2 × ? = 10`

### 2.6 基礎除法題目（目標 ≥ 25 題）
- [ ] DIV 參數化模板 × 2：擴展範圍 aMax:50, bMax:9
- [ ] DIRECT 精選除法題

### 2.7 G2 文字題擴充（目標 ≥ 20 題，含乘除情境）
- [ ] WORD_PROBLEM 乘法情境模板 × 5（分組、重複加法）
- [ ] WORD_PROBLEM 除法情境模板 × 5（平分、分裝）
- [ ] DIRECT 乘法文字題
- [ ] DIRECT 除法文字題

---

## Commit 3：Admin Actions 支援 + 驗收測試

### 3.1 Admin Actions — `src/actions/admin.ts`
- [ ] `createQuestion` 的 type 型別從 `'DIRECT' | 'ADD' | 'SUB'` 擴充為 `'DIRECT' | 'ADD' | 'SUB' | 'MUL' | 'DIV' | 'WORD_PROBLEM'`
- [ ] 參數化驗證邏輯擴充：MUL/DIV 也需檢查 paramsJson 有效性
- [ ] DIV 額外驗證：若 `aMultipleOfB` 為 true，需確保題目生成邏輯已處理

### 3.2 驗收測試
- [ ] MUL 題型可正常生成，答案正確
- [ ] DIV 題型只生成整除題目，答案正確
- [ ] 5 個新技能可在管理端正常建立與管理
- [ ] 乘法入門技能題數 ≥ 30
- [ ] 九九乘法練習技能題數 ≥ 40
- [ ] 除法入門技能題數 ≥ 25
- [ ] Seed 可正常執行，無錯誤
- [ ] 學生端練習 MUL/DIV 題型正常運作
- [ ] 新題目有對應的解析（explanation）
