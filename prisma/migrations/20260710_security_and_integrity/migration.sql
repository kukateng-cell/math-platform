-- ============================================================================
-- Migration: Security & Data Integrity Fixes
-- Date: 2026-07-10
-- Description:
--   Schema changes for P1-1 through P1-12 security & data integrity fixes,
--   plus backfill for existing data.
--
-- 適用場景：
--   A) 全新安裝（從空白資料庫執行）：所有 CREATE TABLE / CREATE TYPE 會自動建立
--   B) 既有資料庫升級：使用 IF NOT EXISTS / ADD COLUMN IF NOT EXISTS 安全執行
-- ============================================================================

-- ############################################################################
-- PART 1: Enums (Types)
-- ############################################################################
-- 使用 IF NOT EXISTS 確保重複執行安全

DO $$ BEGIN
  CREATE TYPE "GradeLevel" AS ENUM ('K', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PracticeStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ABANDONED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PracticeKind" AS ENUM ('NORMAL', 'PROMOTION', 'CHALLENGE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ############################################################################
-- PART 2: New Tables (IF NOT EXISTS)
-- ############################################################################

CREATE TABLE IF NOT EXISTS "PasswordResetGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetGrant_pkey" PRIMARY KEY ("id")
);

-- ############################################################################
-- PART 3: New Columns on Existing Tables (IF NOT EXISTS)
-- ############################################################################

-- PracticeSession: status, kind, cancelledAt, abandonedAt, gradedQuestionCount, assistedCount
ALTER TABLE "PracticeSession" ADD COLUMN IF NOT EXISTS "status" "PracticeStatus" NOT NULL DEFAULT 'IN_PROGRESS';
ALTER TABLE "PracticeSession" ADD COLUMN IF NOT EXISTS "kind" "PracticeKind" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "PracticeSession" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "PracticeSession" ADD COLUMN IF NOT EXISTS "abandonedAt" TIMESTAMP(3);
ALTER TABLE "PracticeSession" ADD COLUMN IF NOT EXISTS "gradedQuestionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PracticeSession" ADD COLUMN IF NOT EXISTS "assistedCount" INTEGER NOT NULL DEFAULT 0;

-- Attempt: questionId nullable (was NOT NULL before P1-7)
-- If column is already TEXT (nullable by default), no change needed.
-- If it was TEXT NOT NULL, we need to alter.
-- PostgreSQL doesn't have ALTER COLUMN ... SET NULL directly; we check the
-- column's nullability and alter if needed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Attempt' AND column_name = 'questionId'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "Attempt" ALTER COLUMN "questionId" DROP NOT NULL;
  END IF;
END $$;

-- Attempt: questionId foreign key ON DELETE SET NULL (instead of RESTRICT/NO ACTION)
-- We drop the existing FK and recreate it.
-- First check if the FK exists with the wrong action.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'Attempt' AND ccu.column_name = 'questionId'
    AND tc.table_schema = 'public'
  ) THEN
    -- We need to drop and recreate the FK constraint.
    -- First find the exact constraint name
    DECLARE
      fk_name text;
    BEGIN
      SELECT tc.constraint_name INTO fk_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema
      WHERE tc.table_name = 'Attempt'
        AND ccu.column_name = 'questionId'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      LIMIT 1;

      IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE "Attempt" DROP CONSTRAINT IF EXISTS %I', fk_name);
      END IF;
    END;
    -- Recreate with ON DELETE SET NULL
    ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_questionId_fkey"
      FOREIGN KEY ("questionId") REFERENCES "QuestionTemplate"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  ELSE
    -- No FK exists, add it fresh
    ALTER TABLE "Attempt" ADD CONSTRAINT IF NOT EXISTS "Attempt_questionId_fkey"
      FOREIGN KEY ("questionId") REFERENCES "QuestionTemplate"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- OtpCode: attemptCount, lockedAt
ALTER TABLE "OtpCode" ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OtpCode" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);

-- ChildProfile: promotionPassedAt, promotionTarget, promotionRewarded, promotionCount
ALTER TABLE "ChildProfile" ADD COLUMN IF NOT EXISTS "promotionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ChildProfile" ADD COLUMN IF NOT EXISTS "promotionPassedAt" TIMESTAMP(3);
ALTER TABLE "ChildProfile" ADD COLUMN IF NOT EXISTS "promotionTarget" TEXT;
ALTER TABLE "ChildProfile" ADD COLUMN IF NOT EXISTS "promotionRewarded" BOOLEAN NOT NULL DEFAULT false;

-- QuestionTemplate: hint
ALTER TABLE "QuestionTemplate" ADD COLUMN IF NOT EXISTS "hint" TEXT;

-- Badge: isActive (may have been dropped by earlier db push attempts)
ALTER TABLE "Badge" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- ############################################################################
-- PART 4: New Indexes (IF NOT EXISTS)
-- ############################################################################

CREATE INDEX IF NOT EXISTS "PasswordResetGrant_userId_idx" ON "PasswordResetGrant"("userId");
CREATE INDEX IF NOT EXISTS "PasswordResetGrant_expiresAt_idx" ON "PasswordResetGrant"("expiresAt");
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetGrant_jti_key" ON "PasswordResetGrant"("jti");
CREATE INDEX IF NOT EXISTS "OtpCode_identifier_idx" ON "OtpCode"("identifier");
CREATE INDEX IF NOT EXISTS "OtpCode_expiresAt_idx" ON "OtpCode"("expiresAt");

-- ############################################################################
-- PART 5: BACKFILL — 為既有資料補上正確的欄位值
-- ############################################################################

-- 5a. PracticeSession.status: 已有 completedAt 的設為 COMPLETED
UPDATE "PracticeSession"
SET "status" = 'COMPLETED'
WHERE "completedAt" IS NOT NULL
  AND "status" = 'IN_PROGRESS';

-- 5b. PracticeSession.kind: 根據 questionsJson 中的標記判斷特殊類型
-- 注意：__isPromotion / __isChallenge 是 JSON 中的欄位，不是 DB 欄位
UPDATE "PracticeSession"
SET "kind" = 'PROMOTION'
WHERE "questionsJson" LIKE '%"__isPromotion":true%'
  AND "kind" = 'NORMAL';

UPDATE "PracticeSession"
SET "kind" = 'CHALLENGE'
WHERE "questionsJson" LIKE '%"__isChallenge":true%'
  AND "kind" = 'NORMAL';

-- 5c. 從 Attempt 表回填 correctCount、gradedQuestionCount、assistedCount
--     使用子查詢避免巢狀事務問題
WITH session_stats AS (
  SELECT
    "sessionId",
    COUNT(*) FILTER (WHERE "isCorrect" = TRUE AND "assisted" = FALSE) AS correct_count,
    COUNT(*) FILTER (WHERE "assisted" = FALSE) AS graded_count,
    COUNT(*) FILTER (WHERE "assisted" = TRUE) AS assisted_count
  FROM "Attempt"
  GROUP BY "sessionId"
)
UPDATE "PracticeSession" s
SET
  "correctCount" = ss.correct_count,
  "gradedQuestionCount" = ss.graded_count,
  "assistedCount" = ss.assisted_count
FROM session_stats ss
WHERE s.id = ss."sessionId";

-- 5d. 為所有缺少 hint 的 QuestionTemplate 補上安全提示文字（根據技能代碼）
--     此處只補最常見的技能，完整對應表見 prisma/seed.ts 或 scripts/add-hints-to-questions.ts
UPDATE "QuestionTemplate" qt
SET "hint" = CASE s."code"
  WHEN 'count-objects' THEN '一個一個慢慢數，可以用手指或畫圈圈幫忙'
  WHEN 'count-compare' THEN '先數一數每一邊有幾個，再比較大小'
  WHEN 'shape-recognition' THEN '注意看圖形的邊和角，想一想它是什麼形狀'
  WHEN 'add-within-10' THEN '把兩個數合在一起，可以用手指或積木幫忙算'
  WHEN 'add-within-20' THEN '先算個位數，湊到 10 再繼續加'
  WHEN 'sub-within-10' THEN '從大數裡拿走小數，想一想剩下多少'
  WHEN 'sub-within-20' THEN '可以先湊 10 再減，或用畫圖的方式幫忙'
  WHEN 'add-sub-100' THEN '注意十位數和個位數要對齊再算'
  WHEN 'word-problem' THEN '先找出題目裡的數字，判斷是要加還是減'
  WHEN 'intro-multiply' THEN '乘法就是連加，例如 4×3 就是 4+4+4'
  WHEN 'multiply-6-9' THEN '背九九乘法表，想想看口訣是什麼'
  WHEN 'multiply-table' THEN '用九九乘法口訣來算'
  WHEN 'divide-basic' THEN '除法就是平分，想想看每人可以分到多少'
  WHEN 'add-sub-1000' THEN '注意百位、十位、個位要對齊'
  WHEN 'mixed-operations' THEN '先乘除後加減，有括號先算括號'
  WHEN 'time-calc' THEN '把時間換算成分鐘來算比較不容易出錯'
  WHEN 'area-perimeter' THEN '周長是繞一圈的長度，面積是裡面的大小'
  WHEN 'decimal-intro' THEN '小數點要對齊，像整數一樣計算'
  WHEN 'large-multiply' THEN '用直式算，注意進位'
  WHEN 'triangle' THEN '注意三個角的大小，想想看屬於哪一類'
  WHEN 'two-digit-div' THEN '想想看什麼數乘以除數會等於被除數'
  WHEN 'decimal-multiply-divide' THEN '先算數字，再算小數位數'
  WHEN 'factors-multiples' THEN '用質因數分解來找公因數和公倍數'
  WHEN 'equation' THEN '把 x 留在一邊，數字移到另一邊，記得兩邊要平衡'
  WHEN 'polygon-formula' THEN '回想看看這個圖形的公式是什麼'
  WHEN 'fraction-multiply-divide' THEN '乘法分子乘分子、分母乘分母；除法要倒數後相乘'
  WHEN 'ratio' THEN '把比例寫成分數來算'
  ELSE NULL
END
FROM "Skill" s
WHERE qt."skillId" = s.id
  AND qt."hint" IS NULL;
