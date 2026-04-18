import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole } from "../common/user-role";
import type { RowDataPacket } from "mysql2/promise";
import { MySQLService } from "../database/mysql.service";
import type { JwtPayload } from "../common/types/jwt-payload";
import type { ClassAnalyticsResponse } from "./dto/class-analytics.dto";
import type { StudentAnalyticsResponse } from "./dto/student-analytics.dto";
import type { TrendPoint } from "./dto/common.dto";

function toNum(v: { toString(): string } | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

function formatDateYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const PRESENT_LIKE = new Set(["present", "late", "excused"]);

function mergeNumericBuckets(
  buckets: Map<string, { sum: number; count: number }>,
  date: string,
  value: number | null,
) {
  if (value == null || !Number.isFinite(value)) return;
  const cur = buckets.get(date) ?? { sum: 0, count: 0 };
  cur.sum += value;
  cur.count += 1;
  buckets.set(date, cur);
}

function bucketsToTrendPoints(buckets: Map<string, { sum: number; count: number }>): TrendPoint[] {
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { sum, count }]) => ({
      date,
      value: count === 0 ? 0 : sum / count,
    }));
}

type ClassCtxRow = RowDataPacket & {
  id: string;
  name: string;
  primaryTeacherId: string | null;
  subject_name: string;
  subject_code: string;
  term_label: string;
};

type ScoreTrendRow = RowDataPacket & { submittedAt: Date | null; scorePercent: unknown };

function teacherEnrollmentExistsSql(user: JwtPayload, params: unknown[]): string {
  if (user.role === UserRole.TEACHER && user.teacherId) {
    params.push(user.teacherId);
    return ` AND EXISTS (
      SELECT 1 FROM enrollments e
      INNER JOIN classes c ON c.id = e.class_id AND c.deleted_at IS NULL
      WHERE e.student_id = s.id AND e.school_id = s.school_id AND e.deleted_at IS NULL AND c.primary_teacher_id = ?
    )`;
  }
  return "";
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly db: MySQLService) {}

  private async getClassForAnalytics(classId: string, user: JwtPayload) {
    const params: unknown[] = [classId, user.schoolId];
    let teacherClause = "";
    if (user.role === UserRole.TEACHER && user.teacherId) {
      teacherClause = " AND c.primary_teacher_id = ?";
      params.push(user.teacherId);
    }
    const sql = `
      SELECT c.id,
             c.name,
             c.primary_teacher_id AS primaryTeacherId,
             sub.name AS subject_name,
             sub.code AS subject_code,
             t.label AS term_label
      FROM classes c
      INNER JOIN subjects sub ON sub.id = c.subject_id AND sub.deleted_at IS NULL
      INNER JOIN terms t ON t.id = c.term_id AND t.deleted_at IS NULL
      WHERE c.id = ? AND c.school_id = ? AND c.deleted_at IS NULL
      ${teacherClause}
      LIMIT 1
    `;
    const rows = (await this.db.query(sql, params))[0] as ClassCtxRow[];
    const cls = rows[0];
    if (!cls) throw new NotFoundException("Class not found");
    if (user.role === UserRole.TEACHER && user.teacherId && cls.primaryTeacherId !== user.teacherId) {
      throw new ForbiddenException("Not assigned to this class");
    }
    return {
      id: cls.id,
      name: cls.name,
      primaryTeacherId: cls.primaryTeacherId,
      subject: { name: cls.subject_name, code: cls.subject_code },
      term: { label: cls.term_label },
    };
  }

  /** JOIN assessment_results → assessments → classes for class-scoped analytics */
  private classAssessmentJoinWhere(classId: string, user: JwtPayload, params: unknown[]): string {
    params.push(user.schoolId, classId, user.schoolId, user.schoolId);
    let t = "";
    if (user.role === UserRole.TEACHER && user.teacherId) {
      params.push(user.teacherId);
      t = " AND c.primary_teacher_id = ?";
    }
    return `
      FROM assessment_results ar
      INNER JOIN assessments a ON a.id = ar.assessment_id AND a.school_id = ? AND a.deleted_at IS NULL AND a.class_id = ?
      INNER JOIN classes c ON c.id = a.class_id AND c.school_id = ? AND c.deleted_at IS NULL
      WHERE ar.school_id = ? AND ar.deleted_at IS NULL
      ${t}
    `;
  }

  private studentAssessmentJoinWhere(studentId: string, user: JwtPayload, params: unknown[]): string {
    params.push(user.schoolId, studentId, user.schoolId);
    let t = "";
    if (user.role === UserRole.TEACHER && user.teacherId) {
      params.push(user.teacherId);
      t = ` AND a.class_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM classes c2 WHERE c2.id = a.class_id AND c2.deleted_at IS NULL AND c2.primary_teacher_id = ?
      )`;
    }
    return `
      FROM assessment_results ar
      INNER JOIN assessments a ON a.id = ar.assessment_id AND a.deleted_at IS NULL
      WHERE ar.school_id = ? AND ar.student_id = ? AND ar.deleted_at IS NULL
        AND a.school_id = ?
      ${t}
    `;
  }

  private attendanceClassScopeWhere(classId: string, user: JwtPayload, params: unknown[]): string {
    params.push(classId, user.schoolId);
    let t = "";
    if (user.role === UserRole.TEACHER && user.teacherId) {
      params.push(user.teacherId);
      t = " AND c.primary_teacher_id = ?";
    }
    return `
      FROM attendance_records ar
      INNER JOIN classes c ON c.id = ar.class_id AND c.deleted_at IS NULL
      WHERE ar.class_id = ? AND ar.school_id = ? AND ar.deleted_at IS NULL
      ${t}
    `;
  }

  private lmsClassWhere(classId: string, user: JwtPayload, params: unknown[]): string {
    params.push(user.schoolId, classId, user.schoolId);
    let t = "";
    if (user.role === UserRole.TEACHER && user.teacherId) {
      params.push(user.teacherId);
      t = " AND c.primary_teacher_id = ?";
    }
    return `
      FROM lms_activity_events e
      INNER JOIN classes c ON c.id = e.class_id AND c.deleted_at IS NULL
      WHERE e.school_id = ? AND e.class_id = ? AND e.deleted_at IS NULL
        AND c.school_id = ?
      ${t}
    `;
  }

  private lmsStudentWhere(studentId: string, user: JwtPayload, params: unknown[]): string {
    params.push(user.schoolId, studentId);
    let t = "";
    if (user.role === UserRole.TEACHER && user.teacherId) {
      params.push(user.teacherId);
      t = ` AND (
        e.class_id IS NULL OR EXISTS (
          SELECT 1 FROM classes c WHERE c.id = e.class_id AND c.deleted_at IS NULL AND c.primary_teacher_id = ?
        )
      )`;
    }
    return `
      FROM lms_activity_events e
      WHERE e.school_id = ? AND e.student_id = ? AND e.deleted_at IS NULL
      ${t}
    `;
  }

  private async computeClassAverageScore(classId: string, user: JwtPayload): Promise<number> {
    const params: unknown[] = [];
    const join = this.classAssessmentJoinWhere(classId, user, params);
    const sql = `SELECT AVG(ar.score_percent) AS avgScore ${join}`;
    const rows = (await this.db.query(sql, params))[0] as RowDataPacket[];
    return toNum(rows[0]?.avgScore as { toString(): string } | null) ?? 0;
  }

  private async computeClassScoreTrend(classId: string, user: JwtPayload): Promise<TrendPoint[]> {
    const params: unknown[] = [];
    const join = this.classAssessmentJoinWhere(classId, user, params);
    const sql = `SELECT ar.submitted_at AS submittedAt, ar.score_percent AS scorePercent ${join} AND ar.submitted_at IS NOT NULL`;
    const rows = (await this.db.query(sql, params))[0] as ScoreTrendRow[];
    const buckets = new Map<string, { sum: number; count: number }>();
    for (const row of rows) {
      if (!row.submittedAt) continue;
      const pct = toNum(row.scorePercent as { toString(): string } | null);
      mergeNumericBuckets(buckets, formatDateYmd(row.submittedAt), pct);
    }
    return bucketsToTrendPoints(buckets);
  }

  private async computeClassAttendanceRate(classId: string, user: JwtPayload): Promise<number> {
    const params: unknown[] = [];
    const from = this.attendanceClassScopeWhere(classId, user, params);
    const sql = `SELECT ar.status, COUNT(*) AS cnt ${from} GROUP BY ar.status`;
    const rows = (await this.db.query(sql, params))[0] as RowDataPacket[];
    let total = 0;
    let presentLike = 0;
    for (const row of rows) {
      const cnt = Number(row.cnt);
      total += cnt;
      if (PRESENT_LIKE.has(String(row.status))) presentLike += cnt;
    }
    return total === 0 ? 0 : presentLike / total;
  }

  private async computeClassSubmissionRate(classId: string, user: JwtPayload): Promise<number> {
    const paramsSubmitted: unknown[] = [];
    const joinSubmitted = this.classAssessmentJoinWhere(classId, user, paramsSubmitted);
    const sqlSubmitted = `SELECT COUNT(*) AS c ${joinSubmitted} AND ar.submitted_at IS NOT NULL`;
    const paramsTotal: unknown[] = [];
    const joinTotal = this.classAssessmentJoinWhere(classId, user, paramsTotal);
    const sqlTotal = `SELECT COUNT(*) AS c ${joinTotal}`;
    const [subRes, totRes] = await Promise.all([
      this.db.query(sqlSubmitted, paramsSubmitted),
      this.db.query(sqlTotal, paramsTotal),
    ]);
    const subRows = subRes[0] as RowDataPacket[];
    const totRows = totRes[0] as RowDataPacket[];
    const submitted = Number(subRows[0]?.c ?? 0);
    const total = Number(totRows[0]?.c ?? 0);
    return total === 0 ? 0 : submitted / total;
  }

  private async computeClassEngagementScore(classId: string, user: JwtPayload): Promise<number> {
    const params: unknown[] = [];
    const from = this.lmsClassWhere(classId, user, params);
    const sql = `SELECT AVG(e.engagement_score) AS avgEng ${from}`;
    const rows = (await this.db.query(sql, params))[0] as RowDataPacket[];
    return toNum(rows[0]?.avgEng as { toString(): string } | null) ?? 0;
  }

  async getClassAverageScore(classId: string, user: JwtPayload): Promise<number> {
    await this.getClassForAnalytics(classId, user);
    return this.computeClassAverageScore(classId, user);
  }

  async getClassScoreTrend(classId: string, user: JwtPayload): Promise<TrendPoint[]> {
    await this.getClassForAnalytics(classId, user);
    return this.computeClassScoreTrend(classId, user);
  }

  async getClassAttendanceRate(classId: string, user: JwtPayload): Promise<number> {
    await this.getClassForAnalytics(classId, user);
    return this.computeClassAttendanceRate(classId, user);
  }

  async getClassSubmissionRate(classId: string, user: JwtPayload): Promise<number> {
    await this.getClassForAnalytics(classId, user);
    return this.computeClassSubmissionRate(classId, user);
  }

  async getClassEngagementScore(classId: string, user: JwtPayload): Promise<number> {
    await this.getClassForAnalytics(classId, user);
    return this.computeClassEngagementScore(classId, user);
  }

  async getClassAnalytics(classId: string, user: JwtPayload): Promise<ClassAnalyticsResponse> {
    await this.getClassForAnalytics(classId, user);
    const [averageScore, scoreTrend, attendanceRate, submissionRate, engagementScore] = await Promise.all([
      this.computeClassAverageScore(classId, user),
      this.computeClassScoreTrend(classId, user),
      this.computeClassAttendanceRate(classId, user),
      this.computeClassSubmissionRate(classId, user),
      this.computeClassEngagementScore(classId, user),
    ]);
    return {
      averageScore,
      scoreTrend,
      attendanceRate,
      submissionRate,
      engagementScore,
    };
  }

  private async getStudentForAnalytics(studentId: string, user: JwtPayload) {
    const params: unknown[] = [studentId, user.schoolId];
    const teacherClause = teacherEnrollmentExistsSql(user, params);
    const sql = `
      SELECT s.id FROM students s
      WHERE s.id = ? AND s.school_id = ? AND s.deleted_at IS NULL
      ${teacherClause}
      LIMIT 1
    `;
    const rows = (await this.db.query(sql, params))[0] as RowDataPacket[];
    if (!rows[0]) throw new NotFoundException("Student not found");
    return { id: studentId };
  }

  private async computeStudentScoreTimeline(studentId: string, user: JwtPayload): Promise<TrendPoint[]> {
    const params: unknown[] = [];
    const join = this.studentAssessmentJoinWhere(studentId, user, params);
    const sql = `SELECT ar.submitted_at AS submittedAt, ar.score_percent AS scorePercent ${join} AND ar.submitted_at IS NOT NULL`;
    const rows = (await this.db.query(sql, params))[0] as ScoreTrendRow[];
    const buckets = new Map<string, { sum: number; count: number }>();
    for (const row of rows) {
      if (!row.submittedAt) continue;
      mergeNumericBuckets(buckets, formatDateYmd(row.submittedAt), toNum(row.scorePercent as { toString(): string } | null));
    }
    return bucketsToTrendPoints(buckets);
  }

  private async computeStudentAttendanceTimeline(studentId: string, user: JwtPayload): Promise<TrendPoint[]> {
    const params: unknown[] = [studentId, user.schoolId];
    let teacherClause = "";
    if (user.role === UserRole.TEACHER && user.teacherId) {
      params.push(user.teacherId);
      teacherClause = ` AND EXISTS (
        SELECT 1 FROM classes c
        WHERE c.id = ar.class_id AND c.deleted_at IS NULL AND c.primary_teacher_id = ?
      )`;
    }
    const sql = `
      SELECT ar.session_date AS sessionDate, ar.status
      FROM attendance_records ar
      WHERE ar.student_id = ? AND ar.school_id = ? AND ar.deleted_at IS NULL
      ${teacherClause}
    `;
    const rows = (await this.db.query(sql, params))[0] as RowDataPacket[];
    const dayBuckets = new Map<string, { total: number; presentLike: number }>();
    for (const row of rows) {
      const day = formatDateYmd(row.sessionDate as Date);
      const cur = dayBuckets.get(day) ?? { total: 0, presentLike: 0 };
      cur.total += 1;
      if (PRESENT_LIKE.has(String(row.status))) cur.presentLike += 1;
      dayBuckets.set(day, cur);
    }
    return [...dayBuckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { total, presentLike }]) => ({
        date,
        value: total === 0 ? 0 : presentLike / total,
      }));
  }

  private async computeStudentEngagementScore(studentId: string, user: JwtPayload): Promise<number> {
    const params: unknown[] = [];
    const from = this.lmsStudentWhere(studentId, user, params);
    const sql = `SELECT AVG(e.engagement_score) AS avgEng ${from}`;
    const rows = (await this.db.query(sql, params))[0] as RowDataPacket[];
    return toNum(rows[0]?.avgEng as { toString(): string } | null) ?? 0;
  }

  private async computeStudentSubmissionRate(studentId: string, user: JwtPayload): Promise<number> {
    const paramsSubmitted: unknown[] = [];
    const joinSubmitted = this.studentAssessmentJoinWhere(studentId, user, paramsSubmitted);
    const sqlSubmitted = `SELECT COUNT(*) AS c ${joinSubmitted} AND ar.submitted_at IS NOT NULL`;
    const paramsTotal: unknown[] = [];
    const joinTotal = this.studentAssessmentJoinWhere(studentId, user, paramsTotal);
    const sqlTotal = `SELECT COUNT(*) AS c ${joinTotal}`;
    const [subRes, totRes] = await Promise.all([
      this.db.query(sqlSubmitted, paramsSubmitted),
      this.db.query(sqlTotal, paramsTotal),
    ]);
    const subRows = subRes[0] as RowDataPacket[];
    const totRows = totRes[0] as RowDataPacket[];
    const submitted = Number(subRows[0]?.c ?? 0);
    const total = Number(totRows[0]?.c ?? 0);
    return total === 0 ? 0 : submitted / total;
  }

  async getStudentScoreTimeline(studentId: string, user: JwtPayload): Promise<TrendPoint[]> {
    await this.getStudentForAnalytics(studentId, user);
    return this.computeStudentScoreTimeline(studentId, user);
  }

  async getStudentAttendanceTimeline(studentId: string, user: JwtPayload): Promise<TrendPoint[]> {
    await this.getStudentForAnalytics(studentId, user);
    return this.computeStudentAttendanceTimeline(studentId, user);
  }

  async getStudentEngagementScore(studentId: string, user: JwtPayload): Promise<number> {
    await this.getStudentForAnalytics(studentId, user);
    return this.computeStudentEngagementScore(studentId, user);
  }

  async getStudentSubmissionRate(studentId: string, user: JwtPayload): Promise<number> {
    await this.getStudentForAnalytics(studentId, user);
    return this.computeStudentSubmissionRate(studentId, user);
  }

  async getStudentAnalytics(studentId: string, user: JwtPayload): Promise<StudentAnalyticsResponse> {
    await this.getStudentForAnalytics(studentId, user);
    const [scoreTimeline, attendanceTimeline, engagementScore, submissionRate] = await Promise.all([
      this.computeStudentScoreTimeline(studentId, user),
      this.computeStudentAttendanceTimeline(studentId, user),
      this.computeStudentEngagementScore(studentId, user),
      this.computeStudentSubmissionRate(studentId, user),
    ]);
    return {
      scoreTimeline,
      attendanceTimeline,
      engagementScore,
      submissionRate,
    };
  }

  async getClassPerformanceSummary(classId: string, user: JwtPayload) {
    const cls = await this.getClassForAnalytics(classId, user);

    const enSql = `
      SELECT student_id AS studentId FROM enrollments
      WHERE school_id = ? AND class_id = ? AND deleted_at IS NULL AND status = 'active'
    `;
    const enRows = (await this.db.query(enSql, [user.schoolId, classId]))[0] as RowDataPacket[];
    const studentIds = [...new Set(enRows.map((r) => String(r.studentId)))];

    if (studentIds.length === 0) {
      return {
        classId: cls.id,
        className: cls.name,
        subject: cls.subject,
        term: cls.term,
        summary: {
          studentCount: 0,
          assessmentResultRows: 0,
          avgScorePercent: null,
        },
        students: [] as {
          studentId: string;
          displayName: string;
          avgScorePercent: number | null;
          attendanceRate: number | null;
          riskScore: number | null;
          engagementScore: number | null;
          aiNotes: string;
        }[],
      };
    }

    const placeholders = studentIds.map(() => "?").join(", ");

    const aggSql = `
      SELECT COUNT(*) AS cnt, AVG(ar.score_percent) AS avgScore
      FROM assessment_results ar
      INNER JOIN assessments a ON a.id = ar.assessment_id AND a.deleted_at IS NULL
      WHERE ar.school_id = ? AND ar.deleted_at IS NULL
        AND a.class_id = ? AND a.school_id = ? AND a.deleted_at IS NULL
    `;
    const aggRows = (await this.db.query(aggSql, [
      user.schoolId,
      classId,
      user.schoolId,
    ]))[0] as RowDataPacket[];

    const perStudentSql = `
      SELECT ar.student_id AS studentId, AVG(ar.score_percent) AS avgScore
      FROM assessment_results ar
      INNER JOIN assessments a ON a.id = ar.assessment_id AND a.deleted_at IS NULL
      WHERE ar.school_id = ? AND ar.deleted_at IS NULL
        AND a.class_id = ? AND a.school_id = ? AND a.deleted_at IS NULL
        AND ar.student_id IN (${placeholders})
      GROUP BY ar.student_id
    `;
    const perStudentRows = (await this.db.query(perStudentSql, [
      user.schoolId,
      classId,
      user.schoolId,
      ...studentIds,
    ]))[0] as RowDataPacket[];

    const attSql = `
      SELECT ar.student_id AS studentId, ar.status, COUNT(*) AS cnt
      FROM attendance_records ar
      WHERE ar.school_id = ? AND ar.class_id = ? AND ar.deleted_at IS NULL
        AND ar.student_id IN (${placeholders})
      GROUP BY ar.student_id, ar.status
    `;
    const attRows = (await this.db.query(attSql, [
      user.schoolId,
      classId,
      ...studentIds,
    ]))[0] as RowDataPacket[];

    const attendanceByStudent = new Map<string, { total: number; presentLike: number }>();
    for (const sid of studentIds) attendanceByStudent.set(sid, { total: 0, presentLike: 0 });
    for (const row of attRows) {
      const sid = String(row.studentId);
      const cur = attendanceByStudent.get(sid) ?? { total: 0, presentLike: 0 };
      const cnt = Number(row.cnt);
      cur.total += cnt;
      if (PRESENT_LIKE.has(String(row.status))) cur.presentLike += cnt;
      attendanceByStudent.set(sid, cur);
    }

    const scoreMap = new Map(
      perStudentRows.map((p) => [String(p.studentId), toNum(p.avgScore as { toString(): string } | null)]),
    );

    const stSql = `
      SELECT id, display_name AS displayName, given_name AS givenName, family_name AS familyName
      FROM students
      WHERE school_id = ? AND id IN (${placeholders})
    `;
    const students = (await this.db.query(stSql, [user.schoolId, ...studentIds]))[0] as RowDataPacket[];

    return {
      classId: cls.id,
      className: cls.name,
      subject: cls.subject,
      term: cls.term,
      summary: {
        studentCount: studentIds.length,
        assessmentResultRows: Number(aggRows[0]?.cnt ?? 0),
        avgScorePercent: toNum(aggRows[0]?.avgScore as { toString(): string } | null),
      },
      students: students.map((s) => {
        const sid = String(s.id);
        const att = attendanceByStudent.get(sid) ?? { total: 0, presentLike: 0 };
        const attendanceRate = att.total === 0 ? null : att.presentLike / att.total;
        return {
          studentId: sid,
          displayName:
            (s.displayName as string | null) ??
            ([s.givenName, s.familyName].filter(Boolean).join(" ") || sid),
          avgScorePercent: scoreMap.get(sid) ?? null,
          attendanceRate,
          riskScore: null as number | null,
          engagementScore: null as number | null,
          aiNotes: "risk_score and engagement_score reserved for AI service",
        };
      }),
    };
  }

  async getStudentAnalyticsSummary(studentId: string, user: JwtPayload) {
    const params: unknown[] = [studentId, user.schoolId];
    const teacherClause = teacherEnrollmentExistsSql(user, params);
    const stSql = `
      SELECT s.id, s.display_name AS displayName, s.given_name AS givenName, s.family_name AS familyName
      FROM students s
      WHERE s.id = ? AND s.school_id = ? AND s.deleted_at IS NULL
      ${teacherClause}
      LIMIT 1
    `;
    const stRows = (await this.db.query(stSql, params))[0] as RowDataPacket[];
    const student = stRows[0];
    if (!student) throw new NotFoundException("Student not found");

    const perfParams: unknown[] = [];
    const perfJoin = this.studentAssessmentJoinWhere(studentId, user, perfParams);
    const perfSql = `SELECT COUNT(*) AS cnt, AVG(ar.score_percent) AS avgScore ${perfJoin}`;
    const perfRows = (await this.db.query(perfSql, perfParams))[0] as RowDataPacket[];

    const attSql = `
      SELECT status, COUNT(*) AS cnt
      FROM attendance_records
      WHERE school_id = ? AND student_id = ? AND deleted_at IS NULL
      GROUP BY status
    `;
    const attCounts = (await this.db.query(attSql, [user.schoolId, studentId]))[0] as RowDataPacket[];
    let totalSessions = 0;
    let presentSessions = 0;
    for (const row of attCounts) {
      const cnt = Number(row.cnt);
      totalSessions += cnt;
      if (PRESENT_LIKE.has(String(row.status))) presentSessions += cnt;
    }

    const lmsSql = `
      SELECT COUNT(*) AS cnt, AVG(engagement_score) AS avgEng
      FROM lms_activity_events
      WHERE school_id = ? AND student_id = ? AND deleted_at IS NULL
    `;
    const lmsRows = (await this.db.query(lmsSql, [user.schoolId, studentId]))[0] as RowDataPacket[];

    const sid = String(student.id);
    return {
      studentId: sid,
      displayName:
        (student.displayName as string | null) ??
        ([student.givenName, student.familyName].filter(Boolean).join(" ") || sid),
      performance: {
        avgScorePercent: toNum(perfRows[0]?.avgScore as { toString(): string } | null),
        assessmentResultCount: Number(perfRows[0]?.cnt ?? 0),
      },
      attendance: {
        sessionsRecorded: totalSessions,
        presentLikeSessions: presentSessions,
        presentRate: totalSessions === 0 ? null : presentSessions / totalSessions,
      },
      engagement: {
        lmsEventCount: Number(lmsRows[0]?.cnt ?? 0),
        avgEngagementScoreFromLms: toNum(lmsRows[0]?.avgEng as { toString(): string } | null),
      },
      ai: {
        riskScore: null as number | null,
        engagementScore: null as number | null,
        source: "Set by AI service when integrated",
      },
    };
  }
}
