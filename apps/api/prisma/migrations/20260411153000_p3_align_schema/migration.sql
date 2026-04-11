-- AlterTable: students columns from schema.prisma (missing from initial migration)
ALTER TABLE "students" ADD COLUMN "performance" DOUBLE PRECISION,
ADD COLUMN "attendance" DOUBLE PRECISION,
ADD COLUMN "engagement" DOUBLE PRECISION,
ADD COLUMN "risk_score" DOUBLE PRECISION,
ADD COLUMN "deltas" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "tiers" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "flags" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "stability" DOUBLE PRECISION,
ADD COLUMN "class_id" UUID;

-- CreateTable
CREATE TABLE "interventions" (
    "id" TEXT NOT NULL,
    "school_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "class_id" UUID,
    "student_id" UUID,
    "trigger_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "recommendations" JSONB,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interventions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_student_snapshots" (
    "id" TEXT NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "performance" DOUBLE PRECISION,
    "attendance" DOUBLE PRECISION,
    "engagement" DOUBLE PRECISION,
    "riskScore" DOUBLE PRECISION,
    "riskTier" TEXT,
    "riskComposite" DOUBLE PRECISION,
    "riskCategory" TEXT,
    "riskReasons" JSONB,
    "riskStability" DOUBLE PRECISION,
    "riskDeltas" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_student_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_class_snapshots" (
    "id" TEXT NOT NULL,
    "schoolId" UUID NOT NULL,
    "classId" UUID NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "performance" DOUBLE PRECISION,
    "attendance" DOUBLE PRECISION,
    "engagement" DOUBLE PRECISION,
    "riskScore" DOUBLE PRECISION,
    "riskComposite" DOUBLE PRECISION,
    "riskCategory" TEXT,
    "riskReasons" JSONB,
    "riskStability" DOUBLE PRECISION,
    "riskDeltas" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_class_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_cohort_snapshots" (
    "id" TEXT NOT NULL,
    "schoolId" UUID NOT NULL,
    "cohortType" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "performance" DOUBLE PRECISION,
    "attendance" DOUBLE PRECISION,
    "engagement" DOUBLE PRECISION,
    "riskLow" INTEGER,
    "riskMedium" INTEGER,
    "riskHigh" INTEGER,
    "riskAverage" DOUBLE PRECISION,
    "interventions" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_cohort_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_school_snapshots" (
    "id" TEXT NOT NULL,
    "schoolId" UUID NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "performance" DOUBLE PRECISION,
    "attendance" DOUBLE PRECISION,
    "engagement" DOUBLE PRECISION,
    "riskLow" INTEGER,
    "riskMedium" INTEGER,
    "riskHigh" INTEGER,
    "riskAverage" DOUBLE PRECISION,
    "interventionsCreated" INTEGER,
    "interventionsResolved" INTEGER,
    "riskComposite" DOUBLE PRECISION,
    "riskCategory" TEXT,
    "riskReasons" JSONB,
    "riskStability" DOUBLE PRECISION,
    "riskDeltas" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_school_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interventions_school_id_idx" ON "interventions"("school_id");

-- CreateIndex
CREATE INDEX "interventions_teacher_id_idx" ON "interventions"("teacher_id");

-- CreateIndex
CREATE INDEX "interventions_status_idx" ON "interventions"("status");

-- CreateIndex
CREATE INDEX "weekly_student_snapshots_schoolId_weekStartDate_idx" ON "weekly_student_snapshots"("schoolId", "weekStartDate");

-- CreateIndex
CREATE INDEX "weekly_student_snapshots_schoolId_studentId_weekStartDate_idx" ON "weekly_student_snapshots"("schoolId", "studentId", "weekStartDate");

-- CreateIndex
CREATE INDEX "weekly_class_snapshots_schoolId_weekStartDate_idx" ON "weekly_class_snapshots"("schoolId", "weekStartDate");

-- CreateIndex
CREATE INDEX "weekly_class_snapshots_schoolId_classId_weekStartDate_idx" ON "weekly_class_snapshots"("schoolId", "classId", "weekStartDate");

-- CreateIndex
CREATE INDEX "weekly_cohort_snapshots_schoolId_weekStartDate_idx" ON "weekly_cohort_snapshots"("schoolId", "weekStartDate");

-- CreateIndex
CREATE INDEX "weekly_cohort_snapshots_school_cohort_week_idx" ON "weekly_cohort_snapshots"("schoolId", "cohortType", "cohortId", "weekStartDate");

-- CreateIndex
CREATE INDEX "weekly_school_snapshots_schoolId_weekStartDate_idx" ON "weekly_school_snapshots"("schoolId", "weekStartDate");

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
