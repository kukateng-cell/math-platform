-- P2-6：手動加上 unique constraint（Prisma db:push 未正確套用）
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_gradeLevel_order_key" UNIQUE ("gradeLevel", "order");
