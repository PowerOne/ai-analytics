/*
  Warnings:

  - You are about to drop the `ai_student_class_scores` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ai_student_class_scores" DROP CONSTRAINT "ai_student_class_scores_school_id_fkey";

-- DropForeignKey
ALTER TABLE "ai_student_class_scores" DROP CONSTRAINT "fk_ai_scores_class";

-- DropForeignKey
ALTER TABLE "ai_student_class_scores" DROP CONSTRAINT "fk_ai_scores_student";

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "address" TEXT;

-- DropTable
DROP TABLE "ai_student_class_scores";

-- RenameIndex
ALTER INDEX "weekly_cohort_snapshots_school_cohort_week_idx" RENAME TO "weekly_cohort_snapshots_schoolId_cohortType_cohortId_weekSt_idx";
