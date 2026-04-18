-- =============================================================================
-- Migration: users auth + tenant (school_id, teacher_id, role uppercase ENUM)
-- Placeholder school id: 00000000-0000-4000-8000-000000000001
--
-- Apply (example):
--   mysql -u... -p learning_analytics < sql/20260416_users_auth_tenant_migration.sql
--   docker exec -i <mysql-container> mysql -uroot -p... learning_analytics < sql/20260416_users_auth_tenant_migration.sql
--
-- NOTES:
-- - `schools` must use the same collation as `users.school_id` before FK (here: utf8mb4_0900_ai_ci).
-- - Re-running on an already-migrated DB will error (duplicate column / duplicate constraint).
-- =============================================================================

SET NAMES utf8mb4;
SET @placeholder_school_id := '00000000-0000-4000-8000-000000000001';

CREATE TABLE IF NOT EXISTS schools (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO schools (id, name)
VALUES (@placeholder_school_id, 'Default school');

-- If schools existed from an older draft with utf8mb4_unicode_ci, align before FK:
ALTER TABLE schools CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

ALTER TABLE users
  ADD COLUMN school_id VARCHAR(36) NULL AFTER role,
  ADD COLUMN teacher_id INT NULL AFTER school_id,
  ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER teacher_id,
  ADD COLUMN student_id INT NULL COMMENT 'optional: future student-login' AFTER updated_at;

CREATE INDEX idx_users_school_id ON users (school_id);
CREATE INDEX idx_users_teacher_id ON users (teacher_id);

ALTER TABLE users
  ADD COLUMN role_new ENUM('ADMIN', 'PRINCIPAL', 'TEACHER') NULL AFTER student_id;

UPDATE users
SET role_new = CASE LOWER(TRIM(role))
  WHEN 'admin'     THEN 'ADMIN'
  WHEN 'principal' THEN 'PRINCIPAL'
  WHEN 'teacher'    THEN 'TEACHER'
  WHEN 'student'   THEN NULL
  ELSE NULL
END;

-- *** STOP if any rows: SELECT id, email, role, role_new FROM users WHERE role_new IS NULL;
ALTER TABLE users DROP COLUMN role;

ALTER TABLE users
  CHANGE COLUMN role_new role ENUM('ADMIN', 'PRINCIPAL', 'TEACHER') NOT NULL;

UPDATE users
SET school_id = @placeholder_school_id
WHERE school_id IS NULL;

UPDATE users u
INNER JOIN teachers t ON t.user_id = u.id
SET u.teacher_id = t.id
WHERE u.teacher_id IS NULL;

ALTER TABLE users
  ADD CONSTRAINT fk_users_school
  FOREIGN KEY (school_id) REFERENCES schools (id);

ALTER TABLE users
  ADD CONSTRAINT fk_users_teacher
  FOREIGN KEY (teacher_id) REFERENCES teachers (id);

-- Read-only validation (bcrypt prefixes):
-- SELECT id, email FROM users
-- WHERE password_hash IS NULL
--    OR (password_hash NOT LIKE '$2a$%' AND password_hash NOT LIKE '$2b$%' AND password_hash NOT LIKE '$2y$%');
