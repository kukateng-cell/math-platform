-- ############################################################################
-- P1-9：PromotionClaim model（per-promotion claim，取代 promotionRewarded）
-- ----------------------------------------------------------------------------
-- 問題：ChildProfile.promotionRewarded 是全域 Boolean，第一次升學後變成 true，
--   後續 G1→G2、G2→G3 等所有升學都不會再發 bonus。此外 transaction 中無
--   conditional predicate，兩個併發請求可同時讀到舊 grade 後依次成功 increment。
--
-- 修正：
--   1. 新增 PromotionClaim 表，sessionId @unique 確保同一 promotion session
--      只能被 claim 一次（防 race condition）。
--   2. 不同 promotion session（不同 grade 升學）使用不同 sessionId，每次皆可
--      正確發放 bonus。
--   3. 移除 ChildProfile.promotionRewarded（不再需要全域 Boolean）。
-- ############################################################################

-- PromotionClaim 表
CREATE TABLE IF NOT EXISTS "PromotionClaim" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fromGrade" "GradeLevel" NOT NULL,
    "targetGrade" "GradeLevel" NOT NULL,
    "bonusAwarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromotionClaim_pkey" PRIMARY KEY ("id")
);

-- 唯一約束
CREATE UNIQUE INDEX IF NOT EXISTS "PromotionClaim_sessionId_key" ON "PromotionClaim"("sessionId");

-- 索引
CREATE INDEX IF NOT EXISTS "PromotionClaim_childId_idx" ON "PromotionClaim"("childId");
CREATE INDEX IF NOT EXISTS "PromotionClaim_sessionId_idx" ON "PromotionClaim"("sessionId");

-- 外部鍵
ALTER TABLE "PromotionClaim" ADD CONSTRAINT "PromotionClaim_childId_fkey" FOREIGN KEY ("childId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE;
ALTER TABLE "PromotionClaim" ADD CONSTRAINT "PromotionClaim_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PracticeSession"("id") ON DELETE CASCADE;

-- ############################################################################
-- 移除 ChildProfile.promotionRewarded
-- ############################################################################
ALTER TABLE "ChildProfile" DROP COLUMN IF EXISTS "promotionRewarded";

-- ############################################################################
-- 資料回填（Backfill）
-- ----------------------------------------------------------------------------
-- 現有 promotionCount > 0 的孩子：用最後一次 promotion session 建立 PromotionClaim。
-- 只回填有「已完成的 PROMOTION kind session」的孩子，避免建立空 claim。
-- ############################################################################
INSERT INTO "PromotionClaim" ("id", "childId", "sessionId", "fromGrade", "targetGrade", "bonusAwarded", "createdAt")
SELECT
  gen_random_uuid()::text,
  cp."id",
  ps."id",
  -- fromGrade：用孩子 promotionTarget 的前一年級（無法精確推斷時用 K）
  COALESCE(
    CASE cp."promotionTarget"
      WHEN 'G1'::"GradeLevel" THEN 'K'::"GradeLevel"
      WHEN 'G2'::"GradeLevel" THEN 'G1'::"GradeLevel"
      WHEN 'G3'::"GradeLevel" THEN 'G2'::"GradeLevel"
      WHEN 'G4'::"GradeLevel" THEN 'G3'::"GradeLevel"
      WHEN 'G5'::"GradeLevel" THEN 'G4'::"GradeLevel"
      WHEN 'G6'::"GradeLevel" THEN 'G5'::"GradeLevel"
    END,
    'K'::"GradeLevel"
  ),
  cp."promotionTarget",
  TRUE,  -- 既有資料視為 bonus 已發放
  NOW()
FROM "ChildProfile" cp
INNER JOIN "PracticeSession" ps ON ps."childId" = cp."id" AND ps."kind" = 'PROMOTION' AND ps."status" = 'COMPLETED'
WHERE cp."promotionCount" > 0
  AND cp."promotionTarget" IS NOT NULL
  -- 避免 JOIN 到多筆 promotion session：取每 child 最新的那筆
  AND ps."id" = (
    SELECT ps2."id"
    FROM "PracticeSession" ps2
    WHERE ps2."childId" = cp."id"
      AND ps2."kind" = 'PROMOTION'
      AND ps2."status" = 'COMPLETED'
    ORDER BY ps2."completedAt" DESC
    LIMIT 1
  )
ON CONFLICT ("sessionId") DO NOTHING;
