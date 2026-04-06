"""
Raw SQL to pull per-(student, class) aggregates aligned with Prisma table names.

Maps to: students, classes, enrollments, assessments, assessment_results,
attendance_records, assignment_submissions, assignments, lms_activity_events.
"""

# Per enrollment row: base keys + raw inputs for Python feature engineering
FEATURE_BASE_SQL = """
SELECT
  e.school_id::text AS school_id,
  e.student_id::text AS student_id,
  e.class_id::text AS class_id,
  (
    SELECT AVG(ar.score_percent::float)
    FROM assessment_results ar
    INNER JOIN assessments a ON a.id = ar.assessment_id AND a.school_id = ar.school_id
    WHERE ar.school_id = e.school_id
      AND ar.student_id = e.student_id
      AND ar.deleted_at IS NULL
      AND a.deleted_at IS NULL
      AND a.class_id = e.class_id
  ) AS mean_assessment_pct,
  (
    SELECT COUNT(*)::float
    FROM attendance_records att
    WHERE att.school_id = e.school_id
      AND att.student_id = e.student_id
      AND att.class_id = e.class_id
      AND att.deleted_at IS NULL
  ) AS attendance_sessions,
  (
    SELECT COUNT(*) FILTER (WHERE att.status IN ('present', 'late', 'excused'))::float
    FROM attendance_records att
    WHERE att.school_id = e.school_id
      AND att.student_id = e.student_id
      AND att.class_id = e.class_id
      AND att.deleted_at IS NULL
  ) AS attendance_present_like,
  (
    SELECT COUNT(*)::float
    FROM lms_activity_events l
    WHERE l.school_id = e.school_id
      AND l.student_id = e.student_id
      AND (l.class_id = e.class_id OR l.class_id IS NULL)
      AND l.deleted_at IS NULL
      AND l.occurred_at >= NOW() - INTERVAL '120 days'
  ) AS lms_event_count,
  (
    SELECT COUNT(*)::float
    FROM assignment_submissions sub
    INNER JOIN assignments asg ON asg.id = sub.assignment_id AND asg.school_id = sub.school_id
    WHERE sub.school_id = e.school_id
      AND sub.student_id = e.student_id
      AND sub.deleted_at IS NULL
      AND asg.deleted_at IS NULL
      AND asg.class_id = e.class_id
      AND sub.status IN ('submitted', 'graded', 'returned')
  ) AS submissions_count,
  (
    SELECT COUNT(*)::float
    FROM assignments asg
    WHERE asg.school_id = e.school_id
      AND asg.deleted_at IS NULL
      AND asg.class_id = e.class_id
  ) AS assignments_count
FROM enrollments e
WHERE e.school_id = CAST(:school_id AS uuid)
  AND e.deleted_at IS NULL
  AND e.status = 'active'
"""

# Time series for trend: one row per assessment result in class context
ASSESSMENT_SERIES_SQL = """
SELECT
  ar.school_id::text AS school_id,
  ar.student_id::text AS student_id,
  a.class_id::text AS class_id,
  ar.submitted_at AS submitted_at,
  ar.score_percent::float AS score_percent
FROM assessment_results ar
INNER JOIN assessments a ON a.id = ar.assessment_id AND a.school_id = ar.school_id
WHERE ar.school_id = CAST(:school_id AS uuid)
  AND ar.deleted_at IS NULL
  AND a.deleted_at IS NULL
  AND a.class_id IS NOT NULL
ORDER BY ar.student_id, a.class_id, ar.submitted_at NULLS LAST, ar.created_at
"""
