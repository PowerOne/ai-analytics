-- Unified Learning Analytics — core relational model (PostgreSQL)
-- Conventions: snake_case, UUID PKs, tenant column school_id on all operational facts/dims.

BEGIN;

-- ---------------------------------------------------------------------------
-- Extensions (optional: gen_random_uuid is built-in on PostgreSQL 13+)
-- ---------------------------------------------------------------------------
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Reference / tenant
-- ---------------------------------------------------------------------------

CREATE TABLE schools (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  slug              TEXT UNIQUE,
  timezone          TEXT NOT NULL DEFAULT 'UTC',
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_schools_active ON schools (id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Calendar
-- ---------------------------------------------------------------------------

CREATE TABLE academic_years (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  label             TEXT NOT NULL,
  starts_on         DATE NOT NULL,
  ends_on           DATE NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  CONSTRAINT chk_academic_years_dates CHECK (ends_on >= starts_on),
  UNIQUE (school_id, id)
);

CREATE INDEX idx_academic_years_school ON academic_years (school_id);
CREATE UNIQUE INDEX uq_academic_years_school_label
  ON academic_years (school_id, label)
  WHERE deleted_at IS NULL;

CREATE TABLE terms (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  academic_year_id  UUID NOT NULL REFERENCES academic_years (id) ON DELETE CASCADE,
  label             TEXT NOT NULL,
  sequence_no       SMALLINT NOT NULL DEFAULT 1,
  starts_on         DATE NOT NULL,
  ends_on           DATE NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  CONSTRAINT chk_terms_dates CHECK (ends_on >= starts_on),
  UNIQUE (school_id, id)
);

CREATE INDEX idx_terms_school ON terms (school_id);
CREATE INDEX idx_terms_year ON terms (academic_year_id);
CREATE UNIQUE INDEX uq_terms_school_year_seq
  ON terms (school_id, academic_year_id, sequence_no)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

CREATE TABLE teachers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  external_source   TEXT,
  external_id       TEXT,
  given_name        TEXT,
  family_name       TEXT,
  display_name      TEXT,
  email             TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (school_id, id)
);

CREATE UNIQUE INDEX uq_teachers_external
  ON teachers (school_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_teachers_school ON teachers (school_id) WHERE deleted_at IS NULL;

CREATE TABLE students (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  external_source   TEXT,
  external_id       TEXT,
  given_name        TEXT,
  family_name       TEXT,
  display_name      TEXT,
  email             TEXT,
  grade_level       TEXT,
  cohort_year       SMALLINT,
  demographics      JSONB NOT NULL DEFAULT '{}',
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (school_id, id)
);

CREATE UNIQUE INDEX uq_students_external
  ON students (school_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_students_school ON students (school_id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Curriculum: subjects & classes (sections)
-- ---------------------------------------------------------------------------

CREATE TABLE subjects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  code              TEXT NOT NULL,
  name              TEXT NOT NULL,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (school_id, id)
);

CREATE UNIQUE INDEX uq_subjects_school_code
  ON subjects (school_id, code)
  WHERE deleted_at IS NULL;

CREATE TABLE classes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  subject_id        UUID NOT NULL REFERENCES subjects (id) ON DELETE RESTRICT,
  term_id           UUID NOT NULL REFERENCES terms (id) ON DELETE RESTRICT,
  section_code      TEXT,
  name              TEXT NOT NULL,
  primary_teacher_id UUID REFERENCES teachers (id) ON DELETE SET NULL,
  room              TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (school_id, id),
  CONSTRAINT fk_classes_subject_tenant
    FOREIGN KEY (school_id, subject_id) REFERENCES subjects (school_id, id),
  CONSTRAINT fk_classes_term_tenant
    FOREIGN KEY (school_id, term_id) REFERENCES terms (school_id, id),
  CONSTRAINT fk_classes_teacher_tenant
    FOREIGN KEY (school_id, primary_teacher_id) REFERENCES teachers (school_id, id)
);

CREATE INDEX idx_classes_school_term ON classes (school_id, term_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_classes_subject ON classes (school_id, subject_id);

-- Optional co-teaching / team teaching
CREATE TABLE class_teachers (
  school_id         UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  class_id          UUID NOT NULL,
  teacher_id        UUID NOT NULL,
  role              TEXT NOT NULL DEFAULT 'instructor',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (school_id, class_id, teacher_id),
  CONSTRAINT fk_ct_class FOREIGN KEY (school_id, class_id) REFERENCES classes (school_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_ct_teacher FOREIGN KEY (school_id, teacher_id) REFERENCES teachers (school_id, id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Topics / skills (for mastery & tagging assessments)
-- ---------------------------------------------------------------------------

CREATE TABLE topics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  subject_id        UUID REFERENCES subjects (id) ON DELETE SET NULL,
  parent_topic_id   UUID,
  code              TEXT,
  name              TEXT NOT NULL,
  depth             SMALLINT NOT NULL DEFAULT 0,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (school_id, id),
  CONSTRAINT fk_topics_subject_tenant
    FOREIGN KEY (school_id, subject_id) REFERENCES subjects (school_id, id),
  CONSTRAINT fk_topics_parent_tenant
    FOREIGN KEY (school_id, parent_topic_id) REFERENCES topics (school_id, id) ON DELETE SET NULL
);

CREATE INDEX idx_topics_school_subject ON topics (school_id, subject_id) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_topics_school_code
  ON topics (school_id, code)
  WHERE code IS NOT NULL AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Enrollments
-- ---------------------------------------------------------------------------

CREATE TABLE enrollments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  student_id        UUID NOT NULL,
  class_id          UUID NOT NULL,
  role              TEXT NOT NULL DEFAULT 'student',
  enrolled_on       DATE,
  status            TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'withdrawn', 'transferred')),
  withdrawn_on      DATE,
  final_grade_points NUMERIC(10, 4),
  final_grade_label TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (school_id, id),
  CONSTRAINT fk_enr_student FOREIGN KEY (school_id, student_id) REFERENCES students (school_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_enr_class FOREIGN KEY (school_id, class_id) REFERENCES classes (school_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_enrollment_member UNIQUE (school_id, student_id, class_id)
);

CREATE INDEX idx_enrollments_student ON enrollments (school_id, student_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_enrollments_class ON enrollments (school_id, class_id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Assessments & results (reporting-friendly columns)
-- ---------------------------------------------------------------------------

CREATE TABLE assessments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  class_id          UUID REFERENCES classes (id) ON DELETE SET NULL,
  term_id           UUID REFERENCES terms (id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  assessment_type   TEXT NOT NULL DEFAULT 'other'
    CHECK (assessment_type IN ('quiz', 'exam', 'project', 'oral', 'homework', 'diagnostic', 'other')),
  max_score         NUMERIC(12, 4),
  weight            NUMERIC(8, 4),
  administered_on   DATE,
  due_at            TIMESTAMPTZ,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (school_id, id),
  CONSTRAINT fk_assess_class FOREIGN KEY (school_id, class_id) REFERENCES classes (school_id, id),
  CONSTRAINT fk_assess_term FOREIGN KEY (school_id, term_id) REFERENCES terms (school_id, id)
);

CREATE INDEX idx_assessments_school_class ON assessments (school_id, class_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assessments_administered ON assessments (school_id, administered_on);

CREATE TABLE assessment_topics (
  school_id         UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  assessment_id     UUID NOT NULL,
  topic_id          UUID NOT NULL,
  coverage_weight   NUMERIC(8, 4) NOT NULL DEFAULT 1.0
    CHECK (coverage_weight >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (school_id, assessment_id, topic_id),
  CONSTRAINT fk_at_assessment FOREIGN KEY (school_id, assessment_id) REFERENCES assessments (school_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_at_topic FOREIGN KEY (school_id, topic_id) REFERENCES topics (school_id, id) ON DELETE CASCADE
);

CREATE TABLE assessment_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  assessment_id     UUID NOT NULL,
  student_id        UUID NOT NULL,
  score_raw         NUMERIC(12, 4),
  score_percent     NUMERIC(7, 4)
    CHECK (score_percent IS NULL OR (score_percent >= 0 AND score_percent <= 100)),
  grade_label       TEXT,
  attempt_no        SMALLINT NOT NULL DEFAULT 1,
  submitted_at      TIMESTAMPTZ,
  graded_at         TIMESTAMPTZ,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (school_id, id),
  CONSTRAINT fk_ar_assessment FOREIGN KEY (school_id, assessment_id) REFERENCES assessments (school_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_ar_student FOREIGN KEY (school_id, student_id) REFERENCES students (school_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_ar_attempt UNIQUE (school_id, assessment_id, student_id, attempt_no)
);

CREATE INDEX idx_ar_student_assessment ON assessment_results (school_id, student_id, assessment_id);
CREATE INDEX idx_ar_submitted ON assessment_results (school_id, submitted_at) WHERE deleted_at IS NULL;

-- Topic-level inferred scores (denormalized for analytics; optional but useful)
CREATE TABLE assessment_result_topic_scores (
  school_id         UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  assessment_result_id UUID NOT NULL,
  topic_id          UUID NOT NULL,
  score_percent     NUMERIC(7, 4)
    CHECK (score_percent IS NULL OR (score_percent >= 0 AND score_percent <= 100)),
  confidence        NUMERIC(7, 4),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (school_id, assessment_result_id, topic_id),
  CONSTRAINT fk_arts_result FOREIGN KEY (school_id, assessment_result_id) REFERENCES assessment_results (school_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_arts_topic FOREIGN KEY (school_id, topic_id) REFERENCES topics (school_id, id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Assignments
-- ---------------------------------------------------------------------------

CREATE TABLE assignments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  class_id          UUID NOT NULL,
  title             TEXT NOT NULL,
  max_points        NUMERIC(12, 4),
  assigned_at       TIMESTAMPTZ,
  due_at            TIMESTAMPTZ,
  submission_type   TEXT NOT NULL DEFAULT 'file'
    CHECK (submission_type IN ('file', 'text', 'quiz', 'external', 'other')),
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (school_id, id),
  CONSTRAINT fk_assignments_class FOREIGN KEY (school_id, class_id) REFERENCES classes (school_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_assignments_class_due ON assignments (school_id, class_id, due_at) WHERE deleted_at IS NULL;

CREATE TABLE assignment_submissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  assignment_id     UUID NOT NULL,
  student_id        UUID NOT NULL,
  status            TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('draft', 'submitted', 'graded', 'returned', 'missing', 'excused')),
  submitted_at      TIMESTAMPTZ,
  points_earned     NUMERIC(12, 4),
  points_percent    NUMERIC(7, 4)
    CHECK (points_percent IS NULL OR (points_percent >= 0 AND points_percent <= 100)),
  is_late           BOOLEAN NOT NULL DEFAULT false,
  attempt_no        SMALLINT NOT NULL DEFAULT 1,
  feedback          TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (school_id, id),
  CONSTRAINT fk_asub_assignment FOREIGN KEY (school_id, assignment_id) REFERENCES assignments (school_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_asub_student FOREIGN KEY (school_id, student_id) REFERENCES students (school_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_asub_attempt UNIQUE (school_id, assignment_id, student_id, attempt_no)
);

CREATE INDEX idx_asub_student ON assignment_submissions (school_id, student_id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Attendance
-- ---------------------------------------------------------------------------

CREATE TABLE attendance_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  class_id          UUID NOT NULL,
  student_id        UUID NOT NULL,
  session_date      DATE NOT NULL,
  session_index     SMALLINT NOT NULL DEFAULT 1,
  minutes_present   SMALLINT,
  status            TEXT NOT NULL DEFAULT 'present'
    CHECK (status IN ('present', 'absent', 'late', 'excused', 'unknown')),
  source            TEXT NOT NULL DEFAULT 'manual',
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (school_id, id),
  CONSTRAINT fk_att_class FOREIGN KEY (school_id, class_id) REFERENCES classes (school_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_att_student FOREIGN KEY (school_id, student_id) REFERENCES students (school_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_attendance_unique UNIQUE (school_id, class_id, student_id, session_date, session_index)
);

CREATE INDEX idx_attendance_student_date ON attendance_records (school_id, student_id, session_date);
CREATE INDEX idx_attendance_class_date ON attendance_records (school_id, class_id, session_date);

-- ---------------------------------------------------------------------------
-- LMS activity (engagement) — flexible event stream
-- ---------------------------------------------------------------------------

CREATE TABLE lms_activity_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  student_id        UUID NOT NULL,
  class_id          UUID,
  occurred_at       TIMESTAMPTZ NOT NULL,
  event_type        TEXT NOT NULL,
  resource_type     TEXT,
  resource_id       TEXT,
  duration_seconds  INTEGER
    CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  engagement_score  NUMERIC(8, 4),
  payload           JSONB NOT NULL DEFAULT '{}',
  source_system     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (school_id, id),
  CONSTRAINT fk_lms_student FOREIGN KEY (school_id, student_id) REFERENCES students (school_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_lms_class FOREIGN KEY (school_id, class_id) REFERENCES classes (school_id, id) ON DELETE SET NULL
);

CREATE INDEX idx_lms_student_time ON lms_activity_events (school_id, student_id, occurred_at DESC);
CREATE INDEX idx_lms_class_time ON lms_activity_events (school_id, class_id, occurred_at DESC) WHERE class_id IS NOT NULL;
CREATE INDEX idx_lms_event_type ON lms_activity_events (school_id, event_type, occurred_at DESC);

COMMIT;
