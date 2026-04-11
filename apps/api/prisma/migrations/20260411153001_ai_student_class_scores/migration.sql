-- Persisted ML outputs (from sql/ai_student_class_scores.sql)
CREATE TABLE "ai_student_class_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "risk_score" DECIMAL(6, 2),
    "risk_level" TEXT NOT NULL,
    "engagement_score" DECIMAL(6, 2) NOT NULL,
    "top_factors" JSONB NOT NULL DEFAULT '[]',
    "model_version" TEXT,
    "computed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_student_class_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_student_class_scores_school_id_student_id_class_id_key" ON "ai_student_class_scores"("school_id", "student_id", "class_id");

-- CreateIndex
CREATE INDEX "ai_student_class_scores_school_id_computed_at_idx" ON "ai_student_class_scores"("school_id", "computed_at" DESC);

-- AddForeignKey
ALTER TABLE "ai_student_class_scores" ADD CONSTRAINT "ai_student_class_scores_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_student_class_scores" ADD CONSTRAINT "fk_ai_scores_student" FOREIGN KEY ("school_id", "student_id") REFERENCES "students"("school_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_student_class_scores" ADD CONSTRAINT "fk_ai_scores_class" FOREIGN KEY ("school_id", "class_id") REFERENCES "classes"("school_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
