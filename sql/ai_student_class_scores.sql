-- Persisted ML outputs (written by services/ai batch job or Node sync)
BEGIN;

CREATE TABLE IF NOT EXISTS ai_student_class_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  student_id      UUID NOT NULL,
  class_id        UUID NOT NULL,
  risk_score      NUMERIC(6, 2),
  risk_level      TEXT NOT NULL,
  engagement_score NUMERIC(6, 2) NOT NULL,
  top_factors     JSONB NOT NULL DEFAULT '[]',
  model_version   TEXT,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, student_id, class_id),
  CONSTRAINT fk_ai_scores_student
    FOREIGN KEY (school_id, student_id) REFERENCES students (school_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_scores_class
    FOREIGN KEY (school_id, class_id) REFERENCES classes (school_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_scores_school_computed
  ON ai_student_class_scores (school_id, computed_at DESC);

COMMIT;
