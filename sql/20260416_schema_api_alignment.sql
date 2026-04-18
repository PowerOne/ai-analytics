-- =============================================================================
-- Migration: Align legacy `learning_analytics` MySQL schema with `apps/api`
-- (SQL-only; no Nest changes.) Fixes missing columns/tables vs. services.
--
-- Prerequisite:
--   - `schools` + placeholder id `00000000-0000-4000-8000-000000000001`
--   - `users` tenant migration (sql/20260416_users_auth_tenant_migration.sql)
--
-- Apply (example):
--   docker exec -i <mysql-container> mysql -uroot -p... learning_analytics < sql/20260416_schema_api_alignment.sql
--
-- Re-runs: new tables use IF NOT EXISTS; ALTERs are guarded via information_schema
-- where practical (Oracle MySQL 8 has no ADD COLUMN IF NOT EXISTS).
-- =============================================================================

SET NAMES utf8mb4;
SET @placeholder_school_id := '00000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- 1) Calendar: terms (classes.service, analytics)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS terms (
  id INT NOT NULL AUTO_INCREMENT,
  school_id VARCHAR(36) NOT NULL,
  label VARCHAR(255) NOT NULL,
  starts_on DATE NULL,
  ends_on DATE NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_terms_school (school_id),
  CONSTRAINT fk_terms_school FOREIGN KEY (school_id) REFERENCES schools (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO terms (id, school_id, label, starts_on, ends_on, deleted_at)
SELECT 1, @placeholder_school_id, 'Default term', '2024-09-01', '2025-06-30', NULL
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM terms WHERE id = 1);

SET @default_term_id := (SELECT id FROM terms WHERE school_id = @placeholder_school_id ORDER BY id ASC LIMIT 1);

-- ---------------------------------------------------------------------------
-- 2) subjects: tenant + code + soft-delete (cohort analytics, classes join)
-- ---------------------------------------------------------------------------
SET @subjects_name_idx := (
  SELECT INDEX_NAME
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'subjects'
    AND COLUMN_NAME = 'name'
    AND NON_UNIQUE = 0
    AND SEQ_IN_INDEX = 1
  LIMIT 1
);
SET @drop_subj_uniq := IF(
  @subjects_name_idx IS NOT NULL,
  CONCAT('ALTER TABLE subjects DROP INDEX `', @subjects_name_idx, '`'),
  'SELECT 1'
);
PREPARE dsu FROM @drop_subj_uniq;
EXECUTE dsu;
DEALLOCATE PREPARE dsu;

SET @subj_need_cols := (
  SELECT COUNT(*) = 0 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subjects' AND COLUMN_NAME = 'school_id'
);
SET @sql := IF(
  @subj_need_cols = 1,
  'ALTER TABLE subjects
     ADD COLUMN school_id VARCHAR(36) NULL AFTER id,
     ADD COLUMN code VARCHAR(64) NULL AFTER name,
     ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER code,
     ADD COLUMN updated_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) AFTER deleted_at',
  'SELECT 1'
);
PREPARE subj_ac FROM @sql;
EXECUTE subj_ac;
DEALLOCATE PREPARE subj_ac;

UPDATE subjects
SET
  school_id = COALESCE(school_id, @placeholder_school_id),
  code = COALESCE(NULLIF(TRIM(code), ''), CONCAT('SUB-', id)),
  updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP(3))
WHERE school_id IS NULL OR code IS NULL OR code = '';

SET @subj_school_nullable := (
  SELECT IS_NULLABLE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subjects' AND COLUMN_NAME = 'school_id'
  LIMIT 1
);
SET @sql := IF(
  @subj_school_nullable = 'YES',
  'ALTER TABLE subjects MODIFY school_id VARCHAR(36) NOT NULL, MODIFY code VARCHAR(64) NOT NULL',
  'SELECT 1'
);
PREPARE subj_m FROM @sql;
EXECUTE subj_m;
DEALLOCATE PREPARE subj_m;

-- FK + uniqueness (ignore duplicate constraint name on re-run)
SET @fk_subj_school_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subjects' AND CONSTRAINT_NAME = 'fk_subjects_school'
);
SET @sql := IF(
  @fk_subj_school_exists = 0,
  'ALTER TABLE subjects ADD CONSTRAINT fk_subjects_school FOREIGN KEY (school_id) REFERENCES schools (id)',
  'SELECT 1'
);
PREPARE fss FROM @sql;
EXECUTE fss;
DEALLOCATE PREPARE fss;

SET @uq_subj_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subjects' AND CONSTRAINT_NAME = 'uq_subjects_school_code'
);
SET @sql := IF(
  @uq_subj_exists = 0,
  'ALTER TABLE subjects ADD CONSTRAINT uq_subjects_school_code UNIQUE (school_id, code)',
  'SELECT 1'
);
PREPARE usc FROM @sql;
EXECUTE usc;
DEALLOCATE PREPARE usc;

-- ---------------------------------------------------------------------------
-- 3) teachers: tenant + profile fields (classes LEFT JOIN teachers)
-- ---------------------------------------------------------------------------
SET @tch_need_cols := (
  SELECT COUNT(*) = 0 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teachers' AND COLUMN_NAME = 'school_id'
);
SET @sql := IF(
  @tch_need_cols = 1,
  'ALTER TABLE teachers
     ADD COLUMN school_id VARCHAR(36) NULL AFTER user_id,
     ADD COLUMN display_name VARCHAR(255) NULL AFTER last_name,
     ADD COLUMN given_name VARCHAR(100) NULL AFTER display_name,
     ADD COLUMN family_name VARCHAR(100) NULL AFTER given_name,
     ADD COLUMN email VARCHAR(255) NULL AFTER family_name,
     ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER email,
     ADD COLUMN updated_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) AFTER deleted_at',
  'SELECT 1'
);
PREPARE tch_ac FROM @sql;
EXECUTE tch_ac;
DEALLOCATE PREPARE tch_ac;

UPDATE teachers t
LEFT JOIN users u ON u.id = t.user_id
SET
  t.school_id = COALESCE(t.school_id, @placeholder_school_id),
  t.given_name = COALESCE(t.given_name, t.first_name),
  t.family_name = COALESCE(t.family_name, t.last_name),
  t.display_name = COALESCE(
    NULLIF(TRIM(t.display_name), ''),
    TRIM(CONCAT(COALESCE(t.first_name, ''), ' ', COALESCE(t.last_name, '')))
  ),
  t.email = COALESCE(NULLIF(TRIM(t.email), ''), NULLIF(TRIM(u.email), ''))
WHERE t.school_id IS NULL OR t.display_name IS NULL OR t.email IS NULL;

SET @tch_school_nullable := (
  SELECT IS_NULLABLE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teachers' AND COLUMN_NAME = 'school_id'
  LIMIT 1
);
SET @sql := IF(
  @tch_school_nullable = 'YES',
  'ALTER TABLE teachers MODIFY school_id VARCHAR(36) NOT NULL',
  'SELECT 1'
);
PREPARE tch_m FROM @sql;
EXECUTE tch_m;
DEALLOCATE PREPARE tch_m;

SET @fk_teach_school_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teachers' AND CONSTRAINT_NAME = 'fk_teachers_school'
);
SET @sql := IF(
  @fk_teach_school_exists = 0,
  'ALTER TABLE teachers ADD CONSTRAINT fk_teachers_school FOREIGN KEY (school_id) REFERENCES schools (id)',
  'SELECT 1'
);
PREPARE fts FROM @sql;
EXECUTE fts;
DEALLOCATE PREPARE fts;

-- ---------------------------------------------------------------------------
-- 4) students: tenant + API column names + analytics cache columns
-- ---------------------------------------------------------------------------
SET @stu_need_cols := (
  SELECT COUNT(*) = 0 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'school_id'
);
SET @sql := IF(
  @stu_need_cols = 1,
  'ALTER TABLE students
     ADD COLUMN school_id VARCHAR(36) NULL AFTER id,
     ADD COLUMN given_name VARCHAR(100) NULL AFTER school_id,
     ADD COLUMN family_name VARCHAR(100) NULL AFTER given_name,
     ADD COLUMN display_name VARCHAR(255) NULL AFTER family_name,
     ADD COLUMN email VARCHAR(255) NULL AFTER display_name,
     ADD COLUMN external_source VARCHAR(64) NULL AFTER email,
     ADD COLUMN external_id VARCHAR(128) NULL AFTER external_source,
     ADD COLUMN grade_level VARCHAR(32) NULL AFTER external_id,
     ADD COLUMN cohort_year INT NULL AFTER grade_level,
     ADD COLUMN demographics JSON NULL AFTER cohort_year,
     ADD COLUMN metadata JSON NULL AFTER demographics,
     ADD COLUMN performance DECIMAL(12, 6) NULL AFTER metadata,
     ADD COLUMN attendance DECIMAL(12, 6) NULL AFTER performance,
     ADD COLUMN engagement DECIMAL(12, 6) NULL AFTER attendance,
     ADD COLUMN risk_score DECIMAL(12, 6) NULL AFTER engagement,
     ADD COLUMN deltas JSON NULL AFTER risk_score,
     ADD COLUMN tiers JSON NULL AFTER deltas,
     ADD COLUMN flags JSON NULL AFTER tiers,
     ADD COLUMN stability DECIMAL(12, 6) NULL AFTER flags,
     ADD COLUMN class_id INT NULL AFTER stability,
     ADD COLUMN updated_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) AFTER created_at,
     ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER updated_at',
  'SELECT 1'
);
PREPARE stu_ac FROM @sql;
EXECUTE stu_ac;
DEALLOCATE PREPARE stu_ac;

UPDATE students s
SET
  s.school_id = COALESCE(s.school_id, @placeholder_school_id),
  s.given_name = COALESCE(s.given_name, s.first_name),
  s.family_name = COALESCE(s.family_name, s.last_name),
  s.display_name = COALESCE(
    NULLIF(TRIM(s.display_name), ''),
    TRIM(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, '')))
  ),
  s.external_id = COALESCE(NULLIF(TRIM(s.external_id), ''), CONCAT('STU-', s.id))
WHERE s.school_id IS NULL OR s.given_name IS NULL OR s.family_name IS NULL;

UPDATE students s
LEFT JOIN (
  SELECT e.student_id AS sid, MIN(c.grade) AS g
  FROM enrollments e
  INNER JOIN classes c ON c.id = e.class_id
  GROUP BY e.student_id
) g ON g.sid = s.id
SET s.grade_level = COALESCE(s.grade_level, CAST(g.g AS CHAR))
WHERE s.grade_level IS NULL AND g.g IS NOT NULL;

SET @stu_school_nullable := (
  SELECT IS_NULLABLE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'school_id'
  LIMIT 1
);
SET @sql := IF(
  @stu_school_nullable = 'YES',
  'ALTER TABLE students MODIFY school_id VARCHAR(36) NOT NULL',
  'SELECT 1'
);
PREPARE stu_m FROM @sql;
EXECUTE stu_m;
DEALLOCATE PREPARE stu_m;

SET @fk_stu_school_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND CONSTRAINT_NAME = 'fk_students_school'
);
SET @sql := IF(
  @fk_stu_school_exists = 0,
  'ALTER TABLE students ADD CONSTRAINT fk_students_school FOREIGN KEY (school_id) REFERENCES schools (id)',
  'SELECT 1'
);
PREPARE fsts FROM @sql;
EXECUTE fsts;
DEALLOCATE PREPARE fsts;

-- ---------------------------------------------------------------------------
-- 5) classes: tenant, term, primary_teacher_id (rename from teacher_id)
-- ---------------------------------------------------------------------------
SET @cls_need_cols := (
  SELECT COUNT(*) = 0 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'classes' AND COLUMN_NAME = 'school_id'
);
SET @sql := IF(
  @cls_need_cols = 1,
  'ALTER TABLE classes
     ADD COLUMN school_id VARCHAR(36) NULL AFTER id,
     ADD COLUMN term_id INT NULL AFTER subject_id,
     ADD COLUMN section_code VARCHAR(64) NULL AFTER name,
     ADD COLUMN room VARCHAR(64) NULL AFTER section_code,
     ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER room,
     ADD COLUMN created_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER deleted_at,
     ADD COLUMN updated_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) AFTER created_at',
  'SELECT 1'
);
PREPARE cls_ac FROM @sql;
EXECUTE cls_ac;
DEALLOCATE PREPARE cls_ac;

UPDATE classes c
SET
  c.school_id = COALESCE(c.school_id, @placeholder_school_id),
  c.term_id = COALESCE(c.term_id, @default_term_id)
WHERE c.school_id IS NULL OR c.term_id IS NULL;

SET @cls_school_nullable := (
  SELECT IS_NULLABLE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'classes' AND COLUMN_NAME = 'school_id'
  LIMIT 1
);
SET @sql := IF(
  @cls_school_nullable = 'YES',
  'ALTER TABLE classes MODIFY school_id VARCHAR(36) NOT NULL, MODIFY term_id INT NOT NULL',
  'SELECT 1'
);
PREPARE cls_m FROM @sql;
EXECUTE cls_m;
DEALLOCATE PREPARE cls_m;

SET @fk_cls_school_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'classes' AND CONSTRAINT_NAME = 'fk_classes_school'
);
SET @sql := IF(
  @fk_cls_school_exists = 0,
  'ALTER TABLE classes ADD CONSTRAINT fk_classes_school FOREIGN KEY (school_id) REFERENCES schools (id)',
  'SELECT 1'
);
PREPARE fcs FROM @sql;
EXECUTE fcs;
DEALLOCATE PREPARE fcs;

SET @fk_cls_term_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'classes' AND CONSTRAINT_NAME = 'fk_classes_term'
);
SET @sql := IF(
  @fk_cls_term_exists = 0,
  'ALTER TABLE classes ADD CONSTRAINT fk_classes_term FOREIGN KEY (term_id) REFERENCES terms (id)',
  'SELECT 1'
);
PREPARE fct FROM @sql;
EXECUTE fct;
DEALLOCATE PREPARE fct;

-- Rename legacy teacher_id → primary_teacher_id (preserves FK to teachers in InnoDB)
SET @col_teacher := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'classes' AND COLUMN_NAME = 'teacher_id'
);
SET @col_pt := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'classes' AND COLUMN_NAME = 'primary_teacher_id'
);
SET @sql := IF(
  @col_teacher > 0 AND @col_pt = 0,
  'ALTER TABLE classes CHANGE COLUMN teacher_id primary_teacher_id INT NOT NULL',
  'SELECT 1'
);
PREPARE rpt FROM @sql;
EXECUTE rpt;
DEALLOCATE PREPARE rpt;

-- ---------------------------------------------------------------------------
-- 6) enrollments: tenant + soft-delete + status (dashboards, analytics)
-- ---------------------------------------------------------------------------
SET @enr_need_cols := (
  SELECT COUNT(*) = 0 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'enrollments' AND COLUMN_NAME = 'school_id'
);
SET @sql := IF(
  @enr_need_cols = 1,
  CONCAT(
    'ALTER TABLE enrollments',
    ' ADD COLUMN school_id VARCHAR(36) NULL AFTER id,',
    ' ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT ',
    QUOTE('active'),
    ' AFTER class_id,',
    ' ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT ',
    QUOTE('student'),
    ' AFTER status,',
    ' ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER role,',
    ' ADD COLUMN enrolled_on DATE NULL AFTER deleted_at'
  ),
  'SELECT 1'
);
PREPARE enr_ac FROM @sql;
EXECUTE enr_ac;
DEALLOCATE PREPARE enr_ac;

UPDATE enrollments e
INNER JOIN classes c ON c.id = e.class_id
SET
  e.school_id = COALESCE(e.school_id, c.school_id),
  e.enrolled_on = COALESCE(e.enrolled_on, e.enrollment_date)
WHERE e.school_id IS NULL OR e.enrolled_on IS NULL;

SET @enr_school_nullable := (
  SELECT IS_NULLABLE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'enrollments' AND COLUMN_NAME = 'school_id'
  LIMIT 1
);
SET @sql := IF(
  @enr_school_nullable = 'YES',
  'ALTER TABLE enrollments MODIFY school_id VARCHAR(36) NOT NULL',
  'SELECT 1'
);
PREPARE enr_m FROM @sql;
EXECUTE enr_m;
DEALLOCATE PREPARE enr_m;

SET @fk_enr_school_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'enrollments' AND CONSTRAINT_NAME = 'fk_enrollments_school'
);
SET @sql := IF(
  @fk_enr_school_exists = 0,
  'ALTER TABLE enrollments ADD CONSTRAINT fk_enrollments_school FOREIGN KEY (school_id) REFERENCES schools (id)',
  'SELECT 1'
);
PREPARE fes FROM @sql;
EXECUTE fes;
DEALLOCATE PREPARE fes;

-- ---------------------------------------------------------------------------
-- 7) assessments + assessment_results (split legacy per-student row)
-- ---------------------------------------------------------------------------
SET @asmt_need_cols := (
  SELECT COUNT(*) = 0 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessments' AND COLUMN_NAME = 'school_id'
);
SET @sql := IF(
  @asmt_need_cols = 1,
  'ALTER TABLE assessments
     ADD COLUMN school_id VARCHAR(36) NULL AFTER id,
     ADD COLUMN title VARCHAR(255) NULL AFTER school_id,
     ADD COLUMN administered_on DATE NULL AFTER max_score,
     ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER administered_on,
     ADD COLUMN term_id INT NULL AFTER deleted_at',
  'SELECT 1'
);
PREPARE asmt_ac FROM @sql;
EXECUTE asmt_ac;
DEALLOCATE PREPARE asmt_ac;

SET @asmt_has_legacy_date := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessments' AND COLUMN_NAME = 'date'
);
SET @sql := IF(
  @asmt_has_legacy_date > 0,
  'UPDATE assessments a INNER JOIN classes c ON c.id = a.class_id SET a.school_id = COALESCE(a.school_id, c.school_id), a.title = COALESCE(NULLIF(TRIM(a.title), ''''), CONCAT(UPPER(a.assessment_type), '' '', COALESCE(DATE_FORMAT(a.`date`, ''%Y-%m-%d''), ''''))), a.administered_on = COALESCE(a.administered_on, a.`date`) WHERE a.school_id IS NULL OR a.title IS NULL OR a.administered_on IS NULL',
  'SELECT 1'
);
PREPARE asmt_u FROM @sql;
EXECUTE asmt_u;
DEALLOCATE PREPARE asmt_u;

CREATE TABLE IF NOT EXISTS assessment_results (
  id VARCHAR(36) NOT NULL,
  school_id VARCHAR(36) NOT NULL,
  assessment_id INT NOT NULL,
  student_id INT NOT NULL,
  score_percent DECIMAL(12, 6) NOT NULL,
  submitted_at TIMESTAMP NULL DEFAULT NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_ar_school_assessment (school_id, assessment_id),
  KEY idx_ar_student (school_id, student_id, deleted_at),
  CONSTRAINT fk_ar_school FOREIGN KEY (school_id) REFERENCES schools (id),
  CONSTRAINT fk_ar_assessment FOREIGN KEY (assessment_id) REFERENCES assessments (id) ON DELETE CASCADE,
  CONSTRAINT fk_ar_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO assessment_results (
  id, school_id, assessment_id, student_id, score_percent, submitted_at, deleted_at, created_at
)
SELECT
  UUID(),
  c.school_id,
  a.id,
  a.student_id,
  CASE
    WHEN a.max_score IS NOT NULL AND a.max_score > 0 THEN (a.score / a.max_score) * 100
    ELSE 0
  END,
  TIMESTAMP(a.`date`),
  NULL,
  CURRENT_TIMESTAMP(3)
FROM assessments a
INNER JOIN classes c ON c.id = a.class_id
LEFT JOIN assessment_results r
  ON r.assessment_id = a.id AND r.student_id = a.student_id AND r.deleted_at IS NULL
WHERE r.id IS NULL
  AND EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessments' AND COLUMN_NAME = 'student_id'
  );

-- Drop FK assessments → students when present, then drop legacy per-student columns
SELECT tc.CONSTRAINT_NAME INTO @fk_asmt_stu
FROM information_schema.TABLE_CONSTRAINTS tc
JOIN information_schema.KEY_COLUMN_USAGE kcu
  ON tc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
  AND tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
  AND tc.TABLE_NAME = kcu.TABLE_NAME
WHERE tc.TABLE_SCHEMA = DATABASE()
  AND tc.TABLE_NAME = 'assessments'
  AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
  AND kcu.COLUMN_NAME = 'student_id'
  AND kcu.REFERENCED_TABLE_NAME = 'students'
LIMIT 1;

SET @sql := IF(
  @fk_asmt_stu IS NOT NULL,
  CONCAT('ALTER TABLE assessments DROP FOREIGN KEY `', @fk_asmt_stu, '`'),
  'SELECT 1'
);
PREPARE das FROM @sql;
EXECUTE das;
DEALLOCATE PREPARE das;

-- Drop student_id / score / date only if still present (idempotent)
SET @c_student := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessments' AND COLUMN_NAME = 'student_id'
);
SET @sql := IF(@c_student > 0, 'ALTER TABLE assessments DROP COLUMN student_id', 'SELECT 1');
PREPARE dsc FROM @sql;
EXECUTE dsc;
DEALLOCATE PREPARE dsc;

SET @c_score := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessments' AND COLUMN_NAME = 'score'
);
SET @sql := IF(@c_score > 0, 'ALTER TABLE assessments DROP COLUMN score', 'SELECT 1');
PREPARE dscore FROM @sql;
EXECUTE dscore;
DEALLOCATE PREPARE dscore;

SET @c_date := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessments' AND COLUMN_NAME = 'date'
);
SET @sql := IF(@c_date > 0, 'ALTER TABLE assessments DROP COLUMN `date`', 'SELECT 1');
PREPARE ddate FROM @sql;
EXECUTE ddate;
DEALLOCATE PREPARE ddate;

SET @need_asm_notnull := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assessments'
    AND COLUMN_NAME IN ('school_id', 'title', 'administered_on')
    AND IS_NULLABLE = 'YES'
);
SET @sql := IF(
  @need_asm_notnull > 0,
  'ALTER TABLE assessments MODIFY school_id VARCHAR(36) NOT NULL, MODIFY title VARCHAR(255) NOT NULL, MODIFY administered_on DATE NOT NULL',
  'SELECT 1'
);
PREPARE asmt_m FROM @sql;
EXECUTE asmt_m;
DEALLOCATE PREPARE asmt_m;

SET @fk_asm_school_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessments' AND CONSTRAINT_NAME = 'fk_assessments_school'
);
SET @sql := IF(
  @fk_asm_school_exists = 0,
  'ALTER TABLE assessments ADD CONSTRAINT fk_assessments_school FOREIGN KEY (school_id) REFERENCES schools (id)',
  'SELECT 1'
);
PREPARE fas FROM @sql;
EXECUTE fas;
DEALLOCATE PREPARE fas;

-- ---------------------------------------------------------------------------
-- 8) attendance_records (+ migrate legacy `attendance` if present)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_records (
  id VARCHAR(36) NOT NULL,
  school_id VARCHAR(36) NOT NULL,
  class_id INT NOT NULL,
  student_id INT NOT NULL,
  session_date DATE NOT NULL,
  session_index INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_att_school_class_date (school_id, class_id, session_date),
  KEY idx_att_student (school_id, student_id, deleted_at),
  CONSTRAINT fk_att_school FOREIGN KEY (school_id) REFERENCES schools (id),
  CONSTRAINT fk_att_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE,
  CONSTRAINT fk_att_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO attendance_records (
  id, school_id, class_id, student_id, session_date, session_index, status, deleted_at, created_at
)
SELECT
  UUID(),
  c.school_id,
  a.class_id,
  a.student_id,
  a.`date`,
  0,
  CAST(a.status AS CHAR),
  NULL,
  CURRENT_TIMESTAMP(3)
FROM attendance a
INNER JOIN classes c ON c.id = a.class_id
LEFT JOIN attendance_records r
  ON r.school_id = c.school_id
  AND r.class_id = a.class_id
  AND r.student_id = a.student_id
  AND r.session_date = a.`date`
  AND r.session_index = 0
  AND r.deleted_at IS NULL
WHERE r.id IS NULL
  AND EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance'
  );

-- Optional: keep legacy table for manual audit; rename if it still exists
SET @att_exists := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance'
);
SET @sql := IF(
  @att_exists > 0,
  'RENAME TABLE attendance TO _legacy_attendance_migrated',
  'SELECT 1'
);
PREPARE rat FROM @sql;
EXECUTE rat;
DEALLOCATE PREPARE rat;

-- ---------------------------------------------------------------------------
-- 9) lms_activity_events (empty is fine; queries aggregate / heatmaps)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lms_activity_events (
  id BIGINT NOT NULL AUTO_INCREMENT,
  school_id VARCHAR(36) NOT NULL,
  student_id INT NOT NULL,
  class_id INT NULL,
  occurred_at TIMESTAMP(3) NOT NULL,
  event_type VARCHAR(64) NOT NULL DEFAULT 'activity',
  engagement_score DECIMAL(14, 6) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_lms_school_student_time (school_id, student_id, deleted_at, occurred_at),
  KEY idx_lms_school_class_time (school_id, class_id, deleted_at, occurred_at),
  CONSTRAINT fk_lms_school FOREIGN KEY (school_id) REFERENCES schools (id),
  CONSTRAINT fk_lms_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
  CONSTRAINT fk_lms_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 10) interventions (principal + interventions service)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interventions (
  id VARCHAR(36) NOT NULL,
  school_id VARCHAR(36) NOT NULL,
  teacher_id INT NOT NULL,
  class_id INT NULL,
  student_id INT NULL,
  trigger_type VARCHAR(128) NOT NULL,
  description TEXT NOT NULL,
  notes TEXT NULL,
  recommendations JSON NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_int_school_created (school_id, created_at),
  KEY idx_int_school_teacher (school_id, teacher_id),
  CONSTRAINT fk_int_school FOREIGN KEY (school_id) REFERENCES schools (id),
  CONSTRAINT fk_int_teacher FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE,
  CONSTRAINT fk_int_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE SET NULL,
  CONSTRAINT fk_int_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 11) Weekly snapshot tables (dashboards / trends; may stay empty until jobs run)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weekly_student_snapshots (
  id VARCHAR(36) NOT NULL,
  `schoolId` VARCHAR(36) NOT NULL,
  `studentId` VARCHAR(36) NOT NULL,
  `weekStartDate` DATE NOT NULL,
  performance DECIMAL(14, 6) NULL,
  attendance DECIMAL(14, 6) NULL,
  engagement DECIMAL(14, 6) NULL,
  `riskScore` DECIMAL(14, 6) NULL,
  `riskTier` VARCHAR(32) NULL,
  `riskComposite` DECIMAL(14, 6) NULL,
  `riskCategory` VARCHAR(64) NULL,
  `riskReasons` JSON NULL,
  `riskStability` DECIMAL(14, 6) NULL,
  `riskDeltas` JSON NULL,
  `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_wss_student_week (`schoolId`, `studentId`, `weekStartDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS weekly_class_snapshots (
  id VARCHAR(36) NOT NULL,
  `schoolId` VARCHAR(36) NOT NULL,
  `classId` VARCHAR(36) NOT NULL,
  `weekStartDate` DATE NOT NULL,
  performance DECIMAL(14, 6) NULL,
  attendance DECIMAL(14, 6) NULL,
  engagement DECIMAL(14, 6) NULL,
  `riskScore` DECIMAL(14, 6) NULL,
  `riskComposite` DECIMAL(14, 6) NULL,
  `riskCategory` VARCHAR(64) NULL,
  `riskReasons` JSON NULL,
  `riskStability` DECIMAL(14, 6) NULL,
  `riskDeltas` JSON NULL,
  `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_wcs_class_week (`schoolId`, `classId`, `weekStartDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS weekly_school_snapshots (
  id VARCHAR(36) NOT NULL,
  `schoolId` VARCHAR(36) NOT NULL,
  `weekStartDate` DATE NOT NULL,
  performance DECIMAL(14, 6) NULL,
  attendance DECIMAL(14, 6) NULL,
  engagement DECIMAL(14, 6) NULL,
  `riskLow` INT NULL,
  `riskMedium` INT NULL,
  `riskHigh` INT NULL,
  `riskAverage` DECIMAL(14, 6) NULL,
  `interventionsCreated` INT NULL DEFAULT 0,
  `interventionsResolved` INT NULL DEFAULT 0,
  `riskComposite` DECIMAL(14, 6) NULL,
  `riskCategory` VARCHAR(64) NULL,
  `riskReasons` JSON NULL,
  `riskStability` DECIMAL(14, 6) NULL,
  `riskDeltas` JSON NULL,
  `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_wsch_school_week (`schoolId`, `weekStartDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS weekly_cohort_snapshots (
  id VARCHAR(36) NOT NULL,
  `schoolId` VARCHAR(36) NOT NULL,
  `cohortType` VARCHAR(32) NOT NULL,
  `cohortId` VARCHAR(255) NOT NULL,
  `weekStartDate` DATE NOT NULL,
  name VARCHAR(512) NOT NULL,
  performance DECIMAL(14, 6) NULL,
  attendance DECIMAL(14, 6) NULL,
  engagement DECIMAL(14, 6) NULL,
  `riskLow` INT NULL,
  `riskMedium` INT NULL,
  `riskHigh` INT NULL,
  `riskAverage` DECIMAL(14, 6) NULL,
  interventions INT NULL DEFAULT 0,
  `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_wcoh_school_week (`schoolId`, `weekStartDate`),
  KEY idx_wcoh_lookup (`schoolId`, `cohortType`, `cohortId`, `weekStartDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- Done. Suggested checks:
--   SHOW CREATE TABLE classes;
--   SELECT COUNT(*) FROM assessment_results;
--   SELECT COUNT(*) FROM attendance_records;
-- =============================================================================
