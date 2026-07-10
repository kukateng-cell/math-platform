-- P2-6：加 unique constraint（用不同名稱避免衝突）
ALTER TABLE "Skill" ADD CONSTRAINT "skill_gradelevel_order_unique" UNIQUE ("gradeLevel", "order");
