-- 把現有 String 資料轉成 GradeLevel enum（USING cast）
ALTER TABLE "ChildProfile" ALTER COLUMN "gradeLevel" DROP DEFAULT;
ALTER TABLE "ChildProfile" ALTER COLUMN "gradeLevel" TYPE "GradeLevel" USING "gradeLevel"::"GradeLevel";
ALTER TABLE "ChildProfile" ALTER COLUMN "gradeLevel" SET DEFAULT 'K';

ALTER TABLE "Skill" ALTER COLUMN "gradeLevel" DROP DEFAULT;
ALTER TABLE "Skill" ALTER COLUMN "gradeLevel" TYPE "GradeLevel" USING "gradeLevel"::"GradeLevel";
ALTER TABLE "Skill" ALTER COLUMN "gradeLevel" SET DEFAULT 'K';

ALTER TABLE "ChildProfile" ALTER COLUMN "promotionTarget" TYPE "GradeLevel" USING "promotionTarget"::"GradeLevel";
