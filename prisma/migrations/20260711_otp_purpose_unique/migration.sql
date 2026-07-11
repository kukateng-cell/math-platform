-- ############################################################################
-- P1-3：OtpCode 加入 purpose 欄位 + (identifier, purpose) 聯合唯一鍵
-- ----------------------------------------------------------------------------
-- 問題：原本 OtpCode.identifier 只有 index（非 unique）。generateOtp 使用
--   transaction([deleteMany({ identifier }), create(...)]) 來維護「每個 identifier
--   只有一筆 OTP」，但兩個併發 transaction 仍可能各自建立一行 OTP。
--   驗證時只找最新一行；最新行被刪除後，較舊但未過期的一行可能重新成為
--   可驗證 OTP。此外 attemptCount 用 read-then-write 更新，併發會低估次數。
--
-- 修正：
--   1. 新增 purpose 欄位，區分不同流程（家長登入 vs 忘記密碼 identifier 皆為
--      userId，必須靠 purpose 隔離）。
--   2. (identifier, purpose) 聯合唯一鍵 → generateOtp 改用 atomic upsert，
--      併發不再產生多筆有效 OTP。
--   3. verifyOtp 改用 conditional deleteMany（確保只成功一次）與 atomic
--      increment（錯誤次數不低估）。
-- ############################################################################

-- OtpCode 列為短期資料（5 分鐘過期、驗證成功即刪除）。
-- 套用 unique 前先清空，避免既有重複 identifier 導致 constraint 建立失敗。
DELETE FROM "OtpCode";

-- 加入 purpose 欄位（NOT NULL；既有資料已清空，故不需要 default）
ALTER TABLE "OtpCode" ADD COLUMN IF NOT EXISTS "purpose" TEXT NOT NULL DEFAULT 'LEGACY';

-- 舊的 identifier 單欄 index 不再需要（unique constraint 自帶索引），移除避免冗餘
DROP INDEX IF EXISTS "OtpCode_identifier_idx";

-- (identifier, purpose) 聯合唯一鍵
CREATE UNIQUE INDEX IF NOT EXISTS "OtpCode_identifier_purpose_key"
  ON "OtpCode"("identifier", "purpose");
