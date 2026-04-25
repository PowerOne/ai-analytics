import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { RowDataPacket } from "mysql2/promise";
import { UserRole } from "../common/user-role";
import { AnalyticsService } from "../analytics/analytics.service";
import type { TrendPoint } from "../analytics/dto/common.dto";
import type { JwtPayload } from "../common/types/jwt-payload";
import { LmsHeatmapsService } from "../lms-heatmaps/lms-heatmaps.service";
import { MySQLService } from "../database/mysql.service";
import { RiskService } from "../risk/risk.service";
import { RiskLevel } from "../risk/dto/risk-level.enum";
import { RiskInput, type RiskOutput } from "../risk/risk-engine.types";
import type { CohortDashboardResponse } from "./dto/cohort-dashboard.dto";
import type {
  PrincipalDashboardResponse,
  PrincipalHeatmapBlockDto,
} from "./dto/principal-dashboard.dto";
import type { PrincipalAttEngContributorsResponseDto } from "./dto/principal-attendance-engagement-heatmap.dto";
import { PrincipalAttEngContributorsQueryDto } from "./dto/principal-att-eng-contributors-query.dto";
import type { Class360DashboardResponse } from "./dto/class360-dashboard.dto";
import type { Student360DashboardResponse } from "./dto/student360-dashboard.dto";
import type { TeacherDashboardResponse } from "./dto/teacher-dashboard.dto";
import type { StudentAttentionSummary } from "../weekly-reports/dto/student-attention-summary.dto";
import {
  IntelligenceEngineService,
  type SchoolIntelligenceFullBundle,
} from "../intelligence/intelligence-engine.service";
import { computeSnapshotStability } from "../weekly-reports/snapshot-stability.util";

function toPrincipalScope(user: JwtPayload, schoolId: string): JwtPayload {
  return {
    sub: user.sub,
    email: user.email,
    schoolId,
    role: UserRole.PRINCIPAL,
    teacherId: null,
  };
}

function asTeacherJwt(user: JwtPayload, schoolId: string, teacherId: string): JwtPayload {
  return {
    sub: user.sub,
    email: user.email,
    schoolId,
    role: UserRole.TEACHER,
    teacherId,
  };
}

function formatYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mondayUtcContaining(d: Date): Date {
  const x = new Date(d);
  const day = x.getUTCDay();
  const diff = (day + 6) % 7;
  x.setUTCDate(x.getUTCDate() - diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function deltaPerformance(a: number | null | undefined, b: number | null | undefined): number {
  if (a == null || b == null) return 0;
  return Math.round((a - b) * 10) / 10;
}

function deltaAttendance(a: number | null | undefined, b: number | null | undefined): number {
  if (a == null || b == null) return 0;
  return Math.round((a - b) * 1000) / 1000;
}

function deltaEngagement(a: number | null | undefined, b: number | null | undefined): number {
  if (a == null || b == null) return 0;
  return Math.round(a - b);
}

function deltaRisk(a: number | null | undefined, b: number | null | undefined): number {
  if (a == null || b == null) return 0;
  return Math.round((a - b) * 10) / 10;
}

function deltaCompositeRisk(a: number | null | undefined, b: number | null | undefined): number {
  if (a == null || b == null) return 0;
  return Math.round((a - b) * 10) / 10;
}

function meanTimeline(points: TrendPoint[]): number {
  const vals = points.filter((p) => Number.isFinite(p.value)).map((p) => p.value);
  if (!vals.length) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function isHighSnapshotTier(t: string | null | undefined): boolean {
  return (t ?? "").toUpperCase() === "HIGH";
}

function attendanceDropAttention(attendanceDelta: number): boolean {
  return attendanceDelta < -0.2 || attendanceDelta < -20;
}

function riskTierLabel(level: RiskLevel): string {
  switch (level) {
    case RiskLevel.LOW:
      return "LOW";
    case RiskLevel.MEDIUM:
      return "MEDIUM";
    case RiskLevel.HIGH:
      return "HIGH";
    default:
      return "MEDIUM";
  }
}

function snapshotStrip(s: {
  weekStartDate: Date;
  performance: number | null;
  attendance: number | null;
  engagement: number | null;
  riskScore: number | null;
}) {
  return {
    weekStartDate: s.weekStartDate.toISOString(),
    performance: s.performance,
    attendance: s.attendance,
    engagement: s.engagement,
    riskScore: s.riskScore,
  };
}

@Injectable()
export class DashboardsService {
  constructor(
    private readonly db: MySQLService,
    private readonly analytics: AnalyticsService,
    private readonly risk: RiskService,
    private readonly lmsHeatmaps: LmsHeatmapsService,
    private readonly intelligenceEngine: IntelligenceEngineService,
  ) {}

  private asRows<T extends RowDataPacket>(packet: unknown): T[] {
    return packet as T[];
  }

  private async sqlStudentByIdBare(studentId: string): Promise<Record<string, unknown> | null> {
    const sql = `
      SELECT s.id, s.school_id AS schoolId, s.email, s.grade_level AS gradeLevel,
             s.display_name AS displayName, s.given_name AS givenName, s.family_name AS familyName,
             s.class_id AS classId, s.performance, s.attendance, s.engagement, s.risk_score AS riskScore,
             s.deltas, s.tiers, s.flags, s.stability, s.metadata,
             s.created_at AS createdAt, s.updated_at AS updatedAt
      FROM students s
      WHERE s.id = ? AND s.deleted_at IS NULL
      LIMIT 1
    `;
    const packet = (await this.db.query(sql, [studentId]))[0] as RowDataPacket[];
    const row = this.asRows<RowDataPacket>(packet)[0];
    return row ? { ...row } : null;
  }

  private async sqlEnrollmentFirstForStudent(
    schoolId: string,
    studentId: string,
  ): Promise<{ classId: string } | null> {
    const sql = `
      SELECT class_id AS classId FROM enrollments
      WHERE school_id = ? AND student_id = ? AND status = 'active' AND deleted_at IS NULL
      ORDER BY id ASC
      LIMIT 1
    `;
    const packet = (await this.db.query(sql, [schoolId, studentId]))[0] as RowDataPacket[];
    const r = this.asRows<RowDataPacket & { classId: string }>(packet)[0];
    return r ? { classId: r.classId } : null;
  }

  private async sqlWeeklyStudentSnap(
    schoolId: string,
    studentId: string,
    weekStart: Date,
  ): Promise<Record<string, unknown> | null> {
    const sql = `
      SELECT \`weekStartDate\`, performance, attendance, engagement, \`riskScore\`, \`riskTier\`,
             \`riskComposite\`, \`riskCategory\`, \`riskReasons\`, \`riskStability\`, \`riskDeltas\`
      FROM weekly_student_snapshots
      WHERE \`schoolId\` = ? AND \`studentId\` = ? AND \`weekStartDate\` = ?
      LIMIT 1
    `;
    const packet = (await this.db.query(sql, [schoolId, studentId, weekStart]))[0] as RowDataPacket[];
    const row = this.asRows<RowDataPacket>(packet)[0];
    return row ? { ...row } : null;
  }

  private async sqlWeeklyClassSnap(
    schoolId: string,
    classId: string,
    weekStart: Date,
  ): Promise<Record<string, unknown> | null> {
    const sql = `
      SELECT \`classId\`, \`weekStartDate\`, performance, attendance, engagement, \`riskScore\`,
             \`riskComposite\`, \`riskCategory\`, \`riskReasons\`, \`riskStability\`, \`riskDeltas\`
      FROM weekly_class_snapshots
      WHERE \`schoolId\` = ? AND \`classId\` = ? AND \`weekStartDate\` = ?
      LIMIT 1
    `;
    const packet = (await this.db.query(sql, [schoolId, classId, weekStart]))[0] as RowDataPacket[];
    const row = this.asRows<RowDataPacket>(packet)[0];
    return row ? { ...row } : null;
  }

  private snapToStripShape(row: Record<string, unknown>): {
    weekStartDate: Date;
    performance: number | null;
    attendance: number | null;
    engagement: number | null;
    riskScore: number | null;
  } {
    const w = row.weekStartDate;
    return {
      weekStartDate: w instanceof Date ? w : new Date(String(w)),
      performance: row.performance != null ? Number(row.performance) : null,
      attendance: row.attendance != null ? Number(row.attendance) : null,
      engagement: row.engagement != null ? Number(row.engagement) : null,
      riskScore: row.riskScore != null ? Number(row.riskScore) : null,
    };
  }

  private async sqlInterventionsForStudentHistory(
    schoolId: string,
    studentId: string,
    take: number,
  ): Promise<Record<string, unknown>[]> {
    const sql = `
      SELECT id, school_id AS schoolId, teacher_id AS teacherId, class_id AS classId,
             student_id AS studentId, trigger_type AS triggerType, description, notes,
             recommendations, status, created_at AS createdAt, updated_at AS updatedAt
      FROM interventions
      WHERE school_id = ? AND student_id = ?
      ORDER BY created_at DESC
      LIMIT ${Number(take)}
    `;
    const packet = (await this.db.query(sql, [schoolId, studentId]))[0] as RowDataPacket[];
    return this.asRows<RowDataPacket>(packet).map((r) => ({ ...r }));
  }

  private async sqlEnrollmentTeacherVisible(
    schoolId: string,
    studentId: string,
    teacherId: string,
  ): Promise<boolean> {
    const sql = `
      SELECT e.id FROM enrollments e
      INNER JOIN classes c ON c.id = e.class_id AND c.deleted_at IS NULL
      WHERE e.school_id = ? AND e.student_id = ? AND e.deleted_at IS NULL AND e.status = 'active'
        AND c.primary_teacher_id = ?
      LIMIT 1
    `;
    const packet = (await this.db.query(sql, [schoolId, studentId, teacherId]))[0] as RowDataPacket[];
    return !!this.asRows<RowDataPacket>(packet)[0];
  }

  private async sqlTeacherExists(teacherId: string, schoolId: string): Promise<boolean> {
    const sql = `SELECT id FROM teachers WHERE id = ? AND school_id = ? AND deleted_at IS NULL LIMIT 1`;
    const packet = (await this.db.query(sql, [teacherId, schoolId]))[0] as RowDataPacket[];
    return !!this.asRows<RowDataPacket>(packet)[0];
  }

  private async sqlLoadTeacherClassesWithEnrollments(
    schoolId: string,
    teacherId: string,
  ): Promise<
    {
      id: string;
      name: string;
      enrollments: {
        studentId: string;
        student: {
          id: string;
          displayName: string | null;
          givenName: string | null;
          familyName: string | null;
        };
      }[];
    }[]
  > {
    const classesSql = `
      SELECT id, name FROM classes
      WHERE school_id = ? AND primary_teacher_id = ? AND deleted_at IS NULL
      ORDER BY name ASC
    `;
    const classPacket = (await this.db.query(classesSql, [schoolId, teacherId]))[0] as RowDataPacket[];
    const classRows = this.asRows<RowDataPacket & { id: string; name: string }>(classPacket);
    if (!classRows.length) return [];

    const classIds = classRows.map((r) => r.id);
    const ph = classIds.map(() => "?").join(", ");
    const enSql = `
      SELECT c.id AS classId, c.name,
             e.student_id AS studentId,
             s.id AS student_pk,
             s.display_name AS displayName,
             s.given_name AS givenName,
             s.family_name AS familyName
      FROM enrollments e
      INNER JOIN students s ON s.id = e.student_id AND s.deleted_at IS NULL
      INNER JOIN classes c ON c.id = e.class_id AND c.deleted_at IS NULL
      WHERE e.school_id = ?
        AND e.deleted_at IS NULL
        AND e.status = 'active'
        AND c.primary_teacher_id = ?
        AND e.class_id IN (${ph})
      ORDER BY c.name ASC, e.student_id
    `;
    const enPacket = (await this.db.query(enSql, [schoolId, teacherId, ...classIds]))[0] as RowDataPacket[];
    const enRows = this.asRows<
      RowDataPacket & {
        classId: string;
        name: string;
        studentId: string;
        student_pk: string;
        displayName: string | null;
        givenName: string | null;
        familyName: string | null;
      }
    >(enPacket);

    const byClass = new Map<
      string,
      {
        id: string;
        name: string;
        enrollments: {
          studentId: string;
          student: {
            id: string;
            displayName: string | null;
            givenName: string | null;
            familyName: string | null;
          };
        }[];
      }
    >();
    for (const cr of classRows) {
      byClass.set(cr.id, { id: cr.id, name: cr.name, enrollments: [] });
    }
    for (const r of enRows) {
      const entry = byClass.get(r.classId);
      if (!entry) continue;
      const dup = entry.enrollments.some((x) => x.studentId === r.studentId);
      if (!dup) {
        entry.enrollments.push({
          studentId: r.studentId,
          student: {
            id: r.student_pk,
            displayName: r.displayName,
            givenName: r.givenName,
            familyName: r.familyName,
          },
        });
      }
    }
    return classIds.map((id) => byClass.get(id)!);
  }

  private async sqlWeeklyClassSnapsIn(
    schoolId: string,
    classIds: string[],
    weekStart: Date,
  ): Promise<Record<string, unknown>[]> {
    if (!classIds.length) return [];
    const ph = classIds.map(() => "?").join(", ");
    const sql = `
      SELECT \`classId\`, \`weekStartDate\`, performance, attendance, engagement, \`riskScore\`, \`riskComposite\`
      FROM weekly_class_snapshots
      WHERE \`schoolId\` = ? AND \`weekStartDate\` = ? AND \`classId\` IN (${ph})
    `;
    const packet = (await this.db.query(sql, [schoolId, weekStart, ...classIds]))[0] as RowDataPacket[];
    return this.asRows<RowDataPacket>(packet).map((r) => ({ ...r }));
  }

  private async sqlWeeklyStudentSnapsIn(
    schoolId: string,
    studentIds: string[],
    weekStart: Date,
  ): Promise<Record<string, unknown>[]> {
    if (!studentIds.length) return [];
    const ph = studentIds.map(() => "?").join(", ");
    const sql = `
      SELECT \`studentId\`, \`weekStartDate\`, performance, attendance, engagement, \`riskScore\`,
             \`riskTier\`, \`riskComposite\`, \`riskCategory\`
      FROM weekly_student_snapshots
      WHERE \`schoolId\` = ? AND \`weekStartDate\` = ? AND \`studentId\` IN (${ph})
    `;
    const packet = (await this.db.query(sql, [schoolId, weekStart, ...studentIds]))[0] as RowDataPacket[];
    return this.asRows<RowDataPacket>(packet).map((r) => ({ ...r }));
  }

  private async sqlInterventionCountTeacherSince(
    schoolId: string,
    teacherId: string,
    since: Date,
  ): Promise<number> {
    const sql = `SELECT COUNT(*) AS c FROM interventions WHERE school_id = ? AND teacher_id = ? AND created_at >= ?`;
    const packet = (await this.db.query(sql, [schoolId, teacherId, since]))[0] as RowDataPacket[];
    const r = this.asRows<RowDataPacket & { c: number }>(packet)[0];
    return Number(r?.c ?? 0);
  }

  private async sqlInterventionCountTeacherStudentSince(
    schoolId: string,
    teacherId: string,
    studentId: string,
    since: Date,
  ): Promise<number> {
    const sql = `
      SELECT COUNT(*) AS c FROM interventions
      WHERE school_id = ? AND teacher_id = ? AND student_id = ? AND created_at >= ?
    `;
    const packet = (await this.db.query(sql, [schoolId, teacherId, studentId, since]))[0] as RowDataPacket[];
    const r = this.asRows<RowDataPacket & { c: number }>(packet)[0];
    return Number(r?.c ?? 0);
  }

  private async sqlWeeklyCohortOne(
    schoolId: string,
    cohortType: string,
    cohortId: string,
    weekStart: Date,
  ): Promise<Record<string, unknown> | null> {
    const sql = `
      SELECT \`cohortType\`, \`cohortId\`, name, performance, attendance, engagement,
             \`riskLow\`, \`riskMedium\`, \`riskHigh\`, \`riskAverage\`, interventions
      FROM weekly_cohort_snapshots
      WHERE \`schoolId\` = ? AND \`cohortType\` = ? AND \`cohortId\` = ? AND \`weekStartDate\` = ?
      LIMIT 1
    `;
    const packet = (await this.db.query(sql, [
      schoolId,
      cohortType,
      cohortId,
      weekStart,
    ]))[0] as RowDataPacket[];
    const row = this.asRows<RowDataPacket>(packet)[0];
    return row ? { ...row } : null;
  }

  private async sqlStudent360Base(
    schoolId: string,
    studentId: string,
  ): Promise<Record<string, unknown> | null> {
    const sql = `
      SELECT s.id, s.school_id AS schoolId, s.display_name AS displayName, s.given_name AS givenName,
             s.family_name AS familyName, s.grade_level AS gradeLevel, s.email,
             s.class_id AS classId, s.performance, s.attendance, s.engagement, s.risk_score AS riskScore,
             s.deltas, s.tiers, s.flags, s.stability
      FROM students s
      WHERE s.id = ? AND s.school_id = ? AND s.deleted_at IS NULL
      LIMIT 1
    `;
    const packet = (await this.db.query(sql, [studentId, schoolId]))[0] as RowDataPacket[];
    const row = this.asRows<RowDataPacket>(packet)[0];
    return row ? { ...row } : null;
  }

  private async sqlStudent360EnrollmentRows(
    schoolId: string,
    studentId: string,
    primaryTeacherId: string | null,
  ): Promise<RowDataPacket[]> {
    let sql = `
      SELECT c.id AS cid, c.name AS cname, c.section_code AS sectionCode, c.room AS room,
             sub.id AS subId, sub.name AS subName, sub.code AS subCode,
             term.id AS termId, term.label AS termLabel, term.starts_on AS termStartsOn, term.ends_on AS termEndsOn,
             pt.id AS ptId, pt.display_name AS ptDisplayName, pt.given_name AS ptGivenName,
             pt.family_name AS ptFamilyName, pt.email AS ptEmail, pt.deleted_at AS ptDeletedAt
      FROM enrollments e
      INNER JOIN classes c ON c.id = e.class_id AND c.deleted_at IS NULL
      INNER JOIN subjects sub ON sub.id = c.subject_id
      INNER JOIN terms term ON term.id = c.term_id
      LEFT JOIN teachers pt ON pt.id = c.primary_teacher_id
      WHERE e.student_id = ? AND e.school_id = ? AND e.deleted_at IS NULL AND e.status = 'active'
    `;
    const params: unknown[] = [studentId, schoolId];
    if (primaryTeacherId) {
      sql += ` AND c.primary_teacher_id = ?`;
      params.push(primaryTeacherId);
    }
    sql += ` ORDER BY e.id ASC`;
    const packet = (await this.db.query(sql, params))[0] as RowDataPacket[];
    return this.asRows<RowDataPacket>(packet);
  }

  private async sqlAssessmentResultsForStudent360(
    schoolId: string,
    studentId: string,
    restrictTeacherId: string | null,
  ): Promise<
    {
      id: string;
      assessmentId: string;
      title: string;
      scorePercent: number | null;
      submittedAt: Date | null;
      className: string | null;
    }[]
  > {
    let sql = `
      SELECT ar.id, ar.assessment_id AS assessmentId, ar.score_percent AS scorePercent,
             ar.submitted_at AS submittedAt,
             a.title AS title,
             c.name AS className
      FROM assessment_results ar
      INNER JOIN assessments a ON a.id = ar.assessment_id AND a.school_id = ar.school_id AND a.deleted_at IS NULL
    `;
    const params: unknown[] = [];
    if (restrictTeacherId) {
      sql += `
        INNER JOIN classes c ON c.id = a.class_id AND c.deleted_at IS NULL AND c.primary_teacher_id = ?
      `;
      params.push(restrictTeacherId);
    } else {
      sql += ` LEFT JOIN classes c ON c.id = a.class_id`;
    }
    sql += `
      WHERE ar.school_id = ? AND ar.student_id = ? AND ar.deleted_at IS NULL
      ORDER BY ar.submitted_at DESC, ar.created_at DESC
      LIMIT 20
    `;
    params.push(schoolId, studentId);
    const packet = (await this.db.query(sql, params))[0] as RowDataPacket[];
    return this.asRows<RowDataPacket>(packet).map((r) => ({
      id: String(r.id),
      assessmentId: String(r.assessmentId),
      title: String(r.title ?? ""),
      scorePercent: r.scorePercent != null ? Number(r.scorePercent) : null,
      submittedAt: r.submittedAt instanceof Date ? r.submittedAt : r.submittedAt ? new Date(String(r.submittedAt)) : null,
      className: r.className != null ? String(r.className) : null,
    }));
  }

  private async sqlInterventionCountForStudent(schoolId: string, studentId: string): Promise<number> {
    const sql = `SELECT COUNT(*) AS c FROM interventions WHERE school_id = ? AND student_id = ?`;
    const packet = (await this.db.query(sql, [schoolId, studentId]))[0] as RowDataPacket[];
    return Number(this.asRows<RowDataPacket & { c: number }>(packet)[0]?.c ?? 0);
  }

  private async sqlClass360Header(
    schoolId: string,
    classId: string,
  ): Promise<RowDataPacket | null> {
    const sql = `
      SELECT c.id, c.name, c.section_code AS sectionCode, c.room, c.primary_teacher_id AS primaryTeacherId,
             sub.id AS subjectId, sub.code AS subjectCode, sub.name AS subjectName,
             term.id AS termId, term.label AS termLabel, term.starts_on AS termStartsOn, term.ends_on AS termEndsOn,
             pt.id AS ptId, pt.display_name AS ptDisplayName, pt.given_name AS ptGivenName,
             pt.family_name AS ptFamilyName, pt.email AS ptEmail, pt.deleted_at AS ptDeletedAt
      FROM classes c
      INNER JOIN subjects sub ON sub.id = c.subject_id
      INNER JOIN terms term ON term.id = c.term_id
      LEFT JOIN teachers pt ON pt.id = c.primary_teacher_id
      WHERE c.id = ? AND c.school_id = ? AND c.deleted_at IS NULL
      LIMIT 1
    `;
    const packet = (await this.db.query(sql, [classId, schoolId]))[0] as RowDataPacket[];
    return this.asRows<RowDataPacket>(packet)[0] ?? null;
  }

  private async sqlClass360StudentRows(schoolId: string, classId: string): Promise<RowDataPacket[]> {
    const sql = `
      SELECT s.id AS sid, s.display_name AS displayName, s.given_name AS givenName, s.family_name AS familyName,
             s.grade_level AS gradeLevel, s.risk_score AS riskScore
      FROM enrollments e
      INNER JOIN students s ON s.id = e.student_id AND s.deleted_at IS NULL
      WHERE e.class_id = ? AND e.school_id = ? AND e.deleted_at IS NULL AND e.status = 'active'
      ORDER BY s.display_name ASC, s.family_name ASC, s.given_name ASC
    `;
    const packet = (await this.db.query(sql, [classId, schoolId]))[0] as RowDataPacket[];
    return this.asRows<RowDataPacket>(packet);
  }

  private async sqlStudentsForClassRiskEngine(classId: string): Promise<RowDataPacket[]> {
    const sql = `
      SELECT s.id, s.performance, s.attendance, s.engagement, s.risk_score AS riskScore,
             s.deltas, s.tiers, s.flags, s.stability
      FROM students s
      INNER JOIN enrollments e ON e.student_id = s.id AND e.deleted_at IS NULL AND e.status = 'active'
      WHERE e.class_id = ? AND s.deleted_at IS NULL
    `;
    const packet = (await this.db.query(sql, [classId]))[0] as RowDataPacket[];
    return this.asRows<RowDataPacket>(packet);
  }

  /**
   * Build intervention context and request AI-generated interventions (separate from tryAi summary).
   */
  async getInterventions(studentId: string): Promise<unknown[]> {
    const student = await this.sqlStudentByIdBare(studentId);
    if (!student) return [];

    const schoolId = String(student.schoolId ?? "");
    const scoped: JwtPayload = {
      sub: "interventions",
      email: "interventions@local",
      schoolId,
      role: UserRole.PRINCIPAL,
      teacherId: null,
    };

    const now = new Date();
    const thisWeekMonday = mondayUtcContaining(now);
    const lastWeekMonday = new Date(thisWeekMonday);
    lastWeekMonday.setUTCDate(lastWeekMonday.getUTCDate() - 7);

    const enrollment = await this.sqlEnrollmentFirstForStudent(schoolId, studentId);
    const classId = enrollment?.classId ?? (student.classId != null ? String(student.classId) : "") ?? "";

    const [stThis, stLast, classThis, classLast, schoolThis, schoolLast] = await Promise.all([
      this.sqlWeeklyStudentSnap(schoolId, studentId, thisWeekMonday),
      this.sqlWeeklyStudentSnap(schoolId, studentId, lastWeekMonday),
      classId ? this.sqlWeeklyClassSnap(schoolId, classId, thisWeekMonday) : Promise.resolve(null),
      classId ? this.sqlWeeklyClassSnap(schoolId, classId, lastWeekMonday) : Promise.resolve(null),
      this.intelligenceEngine.loadWeeklySchoolSnapshot(schoolId, thisWeekMonday),
      this.intelligenceEngine.loadWeeklySchoolSnapshot(schoolId, lastWeekMonday),
    ]);

    const classA = classId ? await this.analytics.getClassAnalytics(classId, scoped) : null;

    const riskInput: RiskInput = {
      studentId,
      classId: (student.classId != null ? String(student.classId) : null) || classId || "",
      performance: Number(student.performance ?? 0),
      attendance: Number(student.attendance ?? 0),
      engagement: Number(student.engagement ?? 0),
      riskScore: Number(student.riskScore ?? 0),
      deltas: (student.deltas as RiskInput["deltas"]) ?? { performance: 0, attendance: 0, engagement: 0, risk: 0 },
      tiers: (student.tiers as RiskInput["tiers"]) ?? { performance: 1, attendance: 1, engagement: 1, risk: 1 },
      flags:
        (student.flags as RiskInput["flags"]) ?? {
          lowPerformance: false,
          lowAttendance: false,
          lowEngagement: false,
          highRisk: false,
        },
      stability: Number(student.stability ?? 0),
    };

    const engineRisk: RiskOutput = this.risk.getStudentRiskEngine(riskInput);

    const riskEngineHistory = {
      composite: stThis?.riskComposite != null ? Number(stThis.riskComposite) : null,
      category: stThis?.riskCategory != null ? String(stThis.riskCategory) : null,
      reasons: Array.isArray(stThis?.riskReasons) ? (stThis.riskReasons as string[]) : [],
      stability: stThis?.riskStability != null ? Number(stThis.riskStability) : null,
      deltas: (stThis?.riskDeltas as Record<string, unknown> | null) ?? null,
    };

    const deltas = {
      performanceDelta: deltaPerformance(
        stThis?.performance != null ? Number(stThis.performance) : undefined,
        stLast?.performance != null ? Number(stLast.performance) : undefined,
      ),
      attendanceDelta: deltaAttendance(
        stThis?.attendance != null ? Number(stThis.attendance) : undefined,
        stLast?.attendance != null ? Number(stLast.attendance) : undefined,
      ),
      engagementDelta: deltaEngagement(
        stThis?.engagement != null ? Number(stThis.engagement) : undefined,
        stLast?.engagement != null ? Number(stLast.engagement) : undefined,
      ),
      riskDelta: deltaRisk(
        stThis?.riskScore != null ? Number(stThis.riskScore) : undefined,
        stLast?.riskScore != null ? Number(stLast.riskScore) : undefined,
      ),
      riskCompositeDelta: deltaCompositeRisk(
        stThis?.riskComposite != null ? Number(stThis.riskComposite) : undefined,
        stLast?.riskComposite != null ? Number(stLast.riskComposite) : undefined,
      ),
    };

    const classContext = {
      classId: classId || null,
      averages: classA
        ? {
            performance: classA.averageScore ?? 0,
            attendance: classA.attendanceRate ?? 0,
            engagement: classA.engagementScore ?? 0,
          }
        : null,
      riskComposite: classThis?.riskComposite != null ? Number(classThis.riskComposite) : null,
      riskCompositeDelta: deltaCompositeRisk(
        classThis?.riskComposite != null ? Number(classThis.riskComposite) : undefined,
        classLast?.riskComposite != null ? Number(classLast.riskComposite) : undefined,
      ),
      deltas: {
        performance: deltaPerformance(
          classThis?.performance != null ? Number(classThis.performance) : undefined,
          classLast?.performance != null ? Number(classLast.performance) : undefined,
        ),
        attendance: deltaAttendance(
          classThis?.attendance != null ? Number(classThis.attendance) : undefined,
          classLast?.attendance != null ? Number(classLast.attendance) : undefined,
        ),
        engagement: deltaEngagement(
          classThis?.engagement != null ? Number(classThis.engagement) : undefined,
          classLast?.engagement != null ? Number(classLast.engagement) : undefined,
        ),
        risk: deltaRisk(
          classThis?.riskScore != null ? Number(classThis.riskScore) : undefined,
          classLast?.riskScore != null ? Number(classLast.riskScore) : undefined,
        ),
      },
      thisWeek: classThis ? snapshotStrip(this.snapToStripShape(classThis)) : null,
      lastWeek: classLast ? snapshotStrip(this.snapToStripShape(classLast)) : null,
    };

    const schoolContext = {
      averages: {
        performance: schoolThis?.performance != null ? Number(schoolThis.performance) : null,
        attendance: schoolThis?.attendance != null ? Number(schoolThis.attendance) : null,
        engagement: schoolThis?.engagement != null ? Number(schoolThis.engagement) : null,
      },
      riskComposite: schoolThis?.riskComposite != null ? Number(schoolThis.riskComposite) : null,
      riskCompositeDelta: deltaCompositeRisk(
        schoolThis?.riskComposite != null ? Number(schoolThis.riskComposite) : undefined,
        schoolLast?.riskComposite != null ? Number(schoolLast.riskComposite) : undefined,
      ),
      deltas: {
        performance: deltaPerformance(
          schoolThis?.performance != null ? Number(schoolThis.performance) : undefined,
          schoolLast?.performance != null ? Number(schoolLast.performance) : undefined,
        ),
        attendance: deltaAttendance(
          schoolThis?.attendance != null ? Number(schoolThis.attendance) : undefined,
          schoolLast?.attendance != null ? Number(schoolLast.attendance) : undefined,
        ),
        engagement: deltaEngagement(
          schoolThis?.engagement != null ? Number(schoolThis.engagement) : undefined,
          schoolLast?.engagement != null ? Number(schoolLast.engagement) : undefined,
        ),
        risk: deltaRisk(
          schoolThis?.riskAverage != null ? Number(schoolThis.riskAverage) : undefined,
          schoolLast?.riskAverage != null ? Number(schoolLast.riskAverage) : undefined,
        ),
      },
    };

    const previousInterventions = await this.sqlInterventionsForStudentHistory(schoolId, studentId, 50);

    const payload: Record<string, unknown> = {
      student,
      class: classContext,
      school: schoolContext,
      riskEngine: engineRisk,
      riskEngineHistory,
      deltas,
      snapshots: { thisWeek: stThis, lastWeek: stLast },
      interventionsHistory: previousInterventions ?? [],
    };

    return this.intelligenceEngine.aiPostJsonArray("/generate-interventions", payload);
  }

  assertTeacherSelf(user: JwtPayload, teacherId: string): void {
    if (user.role === UserRole.TEACHER && user.teacherId !== teacherId) {
      throw new ForbiddenException("You can only access your own teacher dashboard");
    }
  }

  async assertStudentVisible(user: JwtPayload, schoolId: string, studentId: string): Promise<void> {
    if (user.role === UserRole.TEACHER && user.teacherId) {
      const ok = await this.sqlEnrollmentTeacherVisible(schoolId, studentId, user.teacherId);
      if (!ok) throw new ForbiddenException("Student is not in your classes");
    }
  }

  async getTeacherDashboard(
    schoolId: string,
    teacherId: string,
    user: JwtPayload,
  ): Promise<TeacherDashboardResponse> {
    this.assertTeacherSelf(user, teacherId);

    const teacherOk = await this.sqlTeacherExists(teacherId, schoolId);
    if (!teacherOk) throw new NotFoundException("Teacher not found");

    const scoped = asTeacherJwt(user, schoolId, teacherId);
    const now = new Date();
    const thisWeekMonday = mondayUtcContaining(now);
    const lastWeekMonday = new Date(thisWeekMonday);
    lastWeekMonday.setUTCDate(lastWeekMonday.getUTCDate() - 7);

    const heatmapFrom = new Date(now);
    heatmapFrom.setUTCDate(heatmapFrom.getUTCDate() - 14);
    const fromStr = formatYmd(heatmapFrom);
    const toStr = formatYmd(now);

    const classes = await this.sqlLoadTeacherClassesWithEnrollments(schoolId, teacherId);

    const classIds = classes.map((c) => c.id);
    const studentIds = new Set<string>();
    for (const c of classes) for (const e of c.enrollments) studentIds.add(e.studentId);
    const studentIdList = [...studentIds];

    const [classThis, classLast, studThis, studLast, schoolThisSnapRow, hm, interventionsThisWeek] =
      await Promise.all([
        this.sqlWeeklyClassSnapsIn(schoolId, classIds, thisWeekMonday),
        this.sqlWeeklyClassSnapsIn(schoolId, classIds, lastWeekMonday),
        this.sqlWeeklyStudentSnapsIn(schoolId, studentIdList, thisWeekMonday),
        this.sqlWeeklyStudentSnapsIn(schoolId, studentIdList, lastWeekMonday),
        this.intelligenceEngine.loadWeeklySchoolSnapshot(schoolId, thisWeekMonday),
        this.lmsHeatmaps.getSchoolHeatmap(schoolId, scoped, fromStr, toStr),
        this.sqlInterventionCountTeacherSince(schoolId, teacherId, thisWeekMonday),
      ]);

    const schoolThisSnap = schoolThisSnapRow as Record<string, unknown> | null;

    const classThisMap = new Map(classThis.map((r) => [String(r.classId), r]));
    const classLastMap = new Map(classLast.map((r) => [String(r.classId), r]));
    const studThisMap = new Map(studThis.map((r) => [String(r.studentId), r]));
    const studLastMap = new Map(studLast.map((r) => [String(r.studentId), r]));

    const classSummaries = classes.map((cls) => {
      const t = classThisMap.get(cls.id);
      const l = classLastMap.get(cls.id);
      return {
        classId: cls.id,
        name: cls.name,
        thisWeek: t ? snapshotStrip(this.snapToStripShape(t)) : null,
        lastWeek: l ? snapshotStrip(this.snapToStripShape(l)) : null,
        performanceDelta: deltaPerformance(
          t?.performance != null ? Number(t.performance) : undefined,
          l?.performance != null ? Number(l.performance) : undefined,
        ),
        attendanceDelta: deltaAttendance(
          t?.attendance != null ? Number(t.attendance) : undefined,
          l?.attendance != null ? Number(l.attendance) : undefined,
        ),
        engagementDelta: deltaEngagement(
          t?.engagement != null ? Number(t.engagement) : undefined,
          l?.engagement != null ? Number(l.engagement) : undefined,
        ),
        riskDelta: deltaRisk(
          t?.riskScore != null ? Number(t.riskScore) : undefined,
          l?.riskScore != null ? Number(l.riskScore) : undefined,
        ),
        riskCompositeDelta: deltaCompositeRisk(
          t?.riskComposite != null ? Number(t.riskComposite) : undefined,
          l?.riskComposite != null ? Number(l.riskComposite) : undefined,
        ),
      };
    });

    const studentNameById = new Map<string, string>();
    for (const c of classes) {
      for (const e of c.enrollments) {
        studentNameById.set(
          e.studentId,
          e.student.displayName ??
            ([e.student.givenName, e.student.familyName].filter(Boolean).join(" ") || e.studentId),
        );
      }
    }

    const attentionRows = await Promise.all(
      studentIdList.map(async (sid) => {
        const st = studThisMap.get(sid);
        const lw = studLastMap.get(sid);
        const performanceDelta = deltaPerformance(
          st?.performance != null ? Number(st.performance) : undefined,
          lw?.performance != null ? Number(lw.performance) : undefined,
        );
        const attendanceDelta = deltaAttendance(
          st?.attendance != null ? Number(st.attendance) : undefined,
          lw?.attendance != null ? Number(lw.attendance) : undefined,
        );
        const engagementDelta = deltaEngagement(
          st?.engagement != null ? Number(st.engagement) : undefined,
          lw?.engagement != null ? Number(lw.engagement) : undefined,
        );
        const riskDelta = deltaRisk(
          st?.riskScore != null ? Number(st.riskScore) : undefined,
          lw?.riskScore != null ? Number(lw.riskScore) : undefined,
        );
        const interventionsThisWeekStudent = await this.sqlInterventionCountTeacherStudentSince(
          schoolId,
          teacherId,
          sid,
          thisWeekMonday,
        );
        const riskTierThisWeek = st?.riskTier != null ? String(st.riskTier) : null;
        const riskTierLastWeek = lw?.riskTier != null ? String(lw.riskTier) : null;
        const riskEngineDelta = deltaCompositeRisk(
          st?.riskComposite != null ? Number(st.riskComposite) : undefined,
          lw?.riskComposite != null ? Number(lw.riskComposite) : undefined,
        );
        const needsAttention =
          (isHighSnapshotTier(riskTierThisWeek) && !isHighSnapshotTier(riskTierLastWeek)) ||
          (String(st?.riskCategory ?? "")).toLowerCase() === "high" ||
          riskEngineDelta > 10 ||
          performanceDelta < -10 ||
          attendanceDropAttention(attendanceDelta) ||
          engagementDelta < -30 ||
          interventionsThisWeekStudent > 0;
        if (!needsAttention) return null;
        const stability = computeSnapshotStability(st as never, lw as never);
        const multiNegative =
          [performanceDelta, attendanceDelta, engagementDelta, riskDelta].filter((d) => d < 0).length >= 2;
        const shouldFetchInterventions =
          (String(st?.riskCategory ?? "")).toLowerCase() === "high" ||
          riskEngineDelta > 10 ||
          multiNegative;
        const interventions = shouldFetchInterventions ? await this.getInterventions(sid) : [];
        return {
          studentId: sid,
          name: studentNameById.get(sid) ?? sid,
          performanceDelta,
          attendanceDelta,
          engagementDelta,
          riskDelta,
          interventionsThisWeek: interventionsThisWeekStudent,
          stability,
          riskEngineDelta,
          interventions,
        } satisfies StudentAttentionSummary;
      }),
    );
    const attentionStudents = attentionRows.filter((r): r is StudentAttentionSummary => r !== null);

    const aiSummary = await this.intelligenceEngine.aiTrySummary("/generate-teacher-dashboard-summary", {
      schoolId,
      teacherId,
      classes: classSummaries,
      attentionStudents,
      interventionsThisWeek,
      interventions: attentionStudents.map((a) => ({
        studentId: a.studentId,
        interventions: a.interventions,
      })),
      riskEngine: null,
      riskEngineHistory: {
        composite: schoolThisSnap?.riskComposite != null ? Number(schoolThisSnap.riskComposite) : null,
        category: schoolThisSnap?.riskCategory != null ? String(schoolThisSnap.riskCategory) : null,
        reasons: Array.isArray(schoolThisSnap?.riskReasons)
          ? (schoolThisSnap.riskReasons as string[])
          : [],
        stability: schoolThisSnap?.riskStability != null ? Number(schoolThisSnap.riskStability) : null,
        deltas: (schoolThisSnap?.riskDeltas as Record<string, unknown> | null) ?? null,
      },
    });

    return {
      teacherId,
      classes: classSummaries,
      attentionStudents,
      interventionsThisWeek,
      heatmap: { daily: hm.heatmap, weekly: hm.weekly },
      aiSummary,
    };
  }

  async getPrincipalDashboard(
  schoolId: string,
  user: JwtPayload,
  range?: { from: Date; to: Date }
): Promise<PrincipalDashboardResponse> {

  const from = range?.from;
  const to = range?.to;

  const intel = (await this.intelligenceEngine.getIntelligenceForSchool(
    schoolId,
    user,
    "full",
    from,
    to,
  )) as SchoolIntelligenceFullBundle;

  return {
    schoolId,
    schoolTrends: intel.deltas,
    cohorts: intel.cohortDashboard,
    interventions: intel.interventions,
    heatmap: intel.heatmaps as PrincipalHeatmapBlockDto,
    principalAttendanceEngagementHeatmap: intel.attendanceEngagementBlock,
    aiSummary: intel.aiSummary,
    schoolInterventions: intel.schoolInterventions,
  };
}


  async getPrincipalAttEngContributors(
    schoolId: string,
    user: JwtPayload,
    query: PrincipalAttEngContributorsQueryDto,
  ): Promise<PrincipalAttEngContributorsResponseDto> {
    if (user.schoolId !== schoolId) {
      throw new ForbiddenException("School mismatch");
    }
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.PRINCIPAL) {
      throw new ForbiddenException();
    }
    return this.intelligenceEngine.getPrincipalAttEngContributors(schoolId, query);
  }

  async getCohortGradeDashboard(
    schoolId: string,
    gradeId: string,
    user: JwtPayload,
  ): Promise<CohortDashboardResponse> {
    const scoped = toPrincipalScope(user, schoolId);
    const now = new Date();
    const thisWeekMonday = mondayUtcContaining(now);
    const lastWeekMonday = new Date(thisWeekMonday);
    lastWeekMonday.setUTCDate(lastWeekMonday.getUTCDate() - 7);
    const key = decodeURIComponent(gradeId);

    const heatmapFrom = new Date(now);
    heatmapFrom.setUTCDate(heatmapFrom.getUTCDate() - 14);
    const fromStr = formatYmd(heatmapFrom);
    const toStr = formatYmd(now);

    const [t, l, hm] = await Promise.all([
      this.sqlWeeklyCohortOne(schoolId, "GRADE", key, thisWeekMonday),
      this.sqlWeeklyCohortOne(schoolId, "GRADE", key, lastWeekMonday),
      this.lmsHeatmaps.getGradeHeatmap(schoolId, key, scoped, fromStr, toStr),
    ]);

    if (!t) {
      throw new NotFoundException("No weekly cohort snapshot for this grade yet");
    }

    const performanceDelta = deltaPerformance(
      t.performance != null ? Number(t.performance) : undefined,
      l?.performance != null ? Number(l.performance) : undefined,
    );
    const attendanceDelta = deltaAttendance(
      t.attendance != null ? Number(t.attendance) : undefined,
      l?.attendance != null ? Number(l.attendance) : undefined,
    );
    const engagementDelta = deltaEngagement(
      t.engagement != null ? Number(t.engagement) : undefined,
      l?.engagement != null ? Number(l.engagement) : undefined,
    );
    const riskDelta = deltaRisk(
      t.riskAverage != null ? Number(t.riskAverage) : undefined,
      l?.riskAverage != null ? Number(l.riskAverage) : undefined,
    );

    const cohortName = String(t.name);

    const aiSummary = await this.intelligenceEngine.aiTrySummary("/generate-cohort-dashboard-summary", {
      schoolId,
      cohortType: "GRADE",
      cohortId: key,
      name: cohortName,
      performanceDelta,
      attendanceDelta,
      engagementDelta,
      riskDelta,
      risk: {
        low: t.riskLow != null ? Number(t.riskLow) : 0,
        medium: t.riskMedium != null ? Number(t.riskMedium) : 0,
        high: t.riskHigh != null ? Number(t.riskHigh) : 0,
        average: t.riskAverage != null ? Number(t.riskAverage) : 0,
      },
      interventions: t.interventions != null ? Number(t.interventions) : 0,
      riskEngine: null,
      riskEngineHistory: null,
    });

    return {
      cohortType: "GRADE",
      cohortId: key,
      name: cohortName,
      performanceDelta,
      attendanceDelta,
      engagementDelta,
      riskDelta,
      risk: {
        low: t.riskLow != null ? Number(t.riskLow) : 0,
        medium: t.riskMedium != null ? Number(t.riskMedium) : 0,
        high: t.riskHigh != null ? Number(t.riskHigh) : 0,
        average: t.riskAverage != null ? Number(t.riskAverage) : 0,
      },
      interventions: t.interventions != null ? Number(t.interventions) : 0,
      heatmap: { daily: hm.heatmap, weekly: hm.weekly },
      aiSummary,
    };
  }

  async getCohortSubjectDashboard(
    schoolId: string,
    subjectId: string,
    user: JwtPayload,
  ): Promise<CohortDashboardResponse> {
    const scoped = toPrincipalScope(user, schoolId);
    const now = new Date();
    const thisWeekMonday = mondayUtcContaining(now);
    const lastWeekMonday = new Date(thisWeekMonday);
    lastWeekMonday.setUTCDate(lastWeekMonday.getUTCDate() - 7);

    const heatmapFrom = new Date(now);
    heatmapFrom.setUTCDate(heatmapFrom.getUTCDate() - 14);
    const fromStr = formatYmd(heatmapFrom);
    const toStr = formatYmd(now);

    const [t, l, hm] = await Promise.all([
      this.sqlWeeklyCohortOne(schoolId, "SUBJECT", subjectId, thisWeekMonday),
      this.sqlWeeklyCohortOne(schoolId, "SUBJECT", subjectId, lastWeekMonday),
      this.lmsHeatmaps.getSubjectHeatmap(schoolId, subjectId, scoped, fromStr, toStr),
    ]);

    if (!t) {
      throw new NotFoundException("No weekly cohort snapshot for this subject yet");
    }

    const performanceDelta = deltaPerformance(
      t.performance != null ? Number(t.performance) : undefined,
      l?.performance != null ? Number(l.performance) : undefined,
    );
    const attendanceDelta = deltaAttendance(
      t.attendance != null ? Number(t.attendance) : undefined,
      l?.attendance != null ? Number(l.attendance) : undefined,
    );
    const engagementDelta = deltaEngagement(
      t.engagement != null ? Number(t.engagement) : undefined,
      l?.engagement != null ? Number(l.engagement) : undefined,
    );
    const riskDelta = deltaRisk(
      t.riskAverage != null ? Number(t.riskAverage) : undefined,
      l?.riskAverage != null ? Number(l.riskAverage) : undefined,
    );

    const cohortNameSub = String(t.name);

    const aiSummary = await this.intelligenceEngine.aiTrySummary("/generate-cohort-dashboard-summary", {
      schoolId,
      cohortType: "SUBJECT",
      cohortId: subjectId,
      name: cohortNameSub,
      performanceDelta,
      attendanceDelta,
      engagementDelta,
      riskDelta,
      risk: {
        low: t.riskLow != null ? Number(t.riskLow) : 0,
        medium: t.riskMedium != null ? Number(t.riskMedium) : 0,
        high: t.riskHigh != null ? Number(t.riskHigh) : 0,
        average: t.riskAverage != null ? Number(t.riskAverage) : 0,
      },
      interventions: t.interventions != null ? Number(t.interventions) : 0,
      riskEngine: null,
      riskEngineHistory: null,
    });

    return {
      cohortType: "SUBJECT",
      cohortId: subjectId,
      name: cohortNameSub,
      performanceDelta,
      attendanceDelta,
      engagementDelta,
      riskDelta,
      risk: {
        low: t.riskLow != null ? Number(t.riskLow) : 0,
        medium: t.riskMedium != null ? Number(t.riskMedium) : 0,
        high: t.riskHigh != null ? Number(t.riskHigh) : 0,
        average: t.riskAverage != null ? Number(t.riskAverage) : 0,
      },
      interventions: t.interventions != null ? Number(t.interventions) : 0,
      heatmap: { daily: hm.heatmap, weekly: hm.weekly },
      aiSummary,
    };
  }

  async getStudent360(
    schoolId: string,
    studentId: string,
    user: JwtPayload,
  ): Promise<Student360DashboardResponse> {
    await this.assertStudentVisible(user, schoolId, studentId);

    const studentRow = await this.sqlStudent360Base(schoolId, studentId);
    if (!studentRow) throw new NotFoundException("Student not found");

    const primaryTeacherFilter =
      user.role === UserRole.TEACHER && user.teacherId ? user.teacherId : null;
    const enRows = await this.sqlStudent360EnrollmentRows(schoolId, studentId, primaryTeacherFilter);

    const student = {
      displayName: studentRow.displayName,
      givenName: studentRow.givenName,
      familyName: studentRow.familyName,
      gradeLevel: studentRow.gradeLevel,
      email: studentRow.email,
      classId: studentRow.classId,
      performance: studentRow.performance,
      attendance: studentRow.attendance,
      engagement: studentRow.engagement,
      riskScore: studentRow.riskScore,
      deltas: studentRow.deltas,
      tiers: studentRow.tiers,
      flags: studentRow.flags,
      stability: studentRow.stability,
      enrollments: enRows.map((r) => ({
        class: {
          id: String(r.cid),
          name: String(r.cname),
          subject: { name: String(r.subName), code: String(r.subCode) },
          sectionCode: r.sectionCode != null ? String(r.sectionCode) : null,
          term: {
            id: String(r.termId),
            label: String(r.termLabel),
            startsOn: new Date(String(r.termStartsOn)),
            endsOn: new Date(String(r.termEndsOn)),
          },
          primaryTeacher:
            r.ptId != null
              ? {
                  id: String(r.ptId),
                  displayName: r.ptDisplayName,
                  givenName: r.ptGivenName,
                  familyName: r.ptFamilyName,
                  email: r.ptEmail,
                  deletedAt: r.ptDeletedAt,
                }
              : null,
        },
      })),
    };

    const displayName =
      (typeof student.displayName === "string" ? student.displayName : "")?.trim() ||
      [student.givenName, student.familyName].filter(Boolean).join(" ").trim() ||
      "Student";

    const identity = {
      displayName,
      givenName: student.givenName as string | null,
      familyName: student.familyName as string | null,
      gradeLevel: student.gradeLevel as string | null,
      email: student.email as string | null,
    };

    const classes = student.enrollments.map((e) => ({
      id: e.class.id,
      name: e.class.name,
      subjectName: e.class.subject.name,
      subjectCode: e.class.subject.code,
      sectionCode: e.class.sectionCode,
      termLabel: e.class.term.label,
    }));

    const teacherById = new Map<string, { id: string; name: string; email: string | null; subject: string | null }>();
    for (const e of student.enrollments) {
      const t = e.class.primaryTeacher;
      if (!t || t.deletedAt) continue;
      if (teacherById.has(t.id)) continue;
      const tName =
        (typeof t.displayName === "string" ? t.displayName : "")?.trim() ||
        [t.givenName, t.familyName].filter(Boolean).join(" ").trim() ||
        "Teacher";
      teacherById.set(t.id, { id: t.id, name: tName, email: t.email as string | null, subject: null });
    }
    const teachers = [...teacherById.values()];

    // Build RiskInput for the Risk Engine
    const riskInput: RiskInput = {
      studentId,
      classId: student.classId != null ? String(student.classId) : "",
      performance: Number(student.performance ?? 0),
      attendance: Number(student.attendance ?? 0),
      engagement: Number(student.engagement ?? 0),
      riskScore: Number(student.riskScore ?? 0),
      deltas: (student.deltas as RiskInput["deltas"]) ?? { performance: 0, attendance: 0, engagement: 0, risk: 0 },
      tiers: (student.tiers as RiskInput["tiers"]) ?? { performance: 1, attendance: 1, engagement: 1, risk: 1 },
      flags:
        (student.flags as RiskInput["flags"]) ?? {
          lowPerformance: false,
          lowAttendance: false,
          lowEngagement: false,
          highRisk: false,
        },
      stability: Number(student.stability ?? 0),
    };

    // Run the Risk Engine
    const engineRisk = this.risk.getStudentRiskEngine(riskInput);

    const scoped =
      user.role === UserRole.TEACHER && user.teacherId
        ? asTeacherJwt(user, schoolId, user.teacherId)
        : toPrincipalScope(user, schoolId);

    const now = new Date();
    const thisWeekMonday = mondayUtcContaining(now);
    const lastWeekMonday = new Date(thisWeekMonday);
    lastWeekMonday.setUTCDate(lastWeekMonday.getUTCDate() - 7);

    const heatmapFrom = new Date(now);
    heatmapFrom.setUTCDate(heatmapFrom.getUTCDate() - 14);
    const fromStr = formatYmd(heatmapFrom);
    const toStr = formatYmd(now);

    const restrictTeacher = user.role === UserRole.TEACHER && user.teacherId ? user.teacherId : null;

    const [stThis, stLast, a, r, hm, interventionCount, assessmentRows] = await Promise.all([
      this.sqlWeeklyStudentSnap(schoolId, studentId, thisWeekMonday),
      this.sqlWeeklyStudentSnap(schoolId, studentId, lastWeekMonday),
      this.analytics.getStudentAnalytics(studentId, scoped),
      this.risk.getStudentRisk(schoolId, studentId, scoped),
      this.lmsHeatmaps.getStudentHeatmap(schoolId, studentId, scoped, fromStr, toStr),
      this.sqlInterventionCountForStudent(schoolId, studentId),
      this.sqlAssessmentResultsForStudent360(schoolId, studentId, restrictTeacher),
    ]);

    const assessments = assessmentRows.map((row) => ({
      id: row.id,
      assessmentId: row.assessmentId,
      title: row.title,
      scorePercent: row.scorePercent,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      className: row.className,
    }));

    const performanceDelta = deltaPerformance(
      stThis?.performance != null ? Number(stThis.performance) : undefined,
      stLast?.performance != null ? Number(stLast.performance) : undefined,
    );
    const attendanceDelta = deltaAttendance(
      stThis?.attendance != null ? Number(stThis.attendance) : undefined,
      stLast?.attendance != null ? Number(stLast.attendance) : undefined,
    );
    const engagementDelta = deltaEngagement(
      stThis?.engagement != null ? Number(stThis.engagement) : undefined,
      stLast?.engagement != null ? Number(stLast.engagement) : undefined,
    );
    const riskDelta = deltaRisk(
      stThis?.riskScore != null ? Number(stThis.riskScore) : undefined,
      stLast?.riskScore != null ? Number(stLast.riskScore) : undefined,
    );
    const riskCompositeDelta = deltaCompositeRisk(
      stThis?.riskComposite != null ? Number(stThis.riskComposite) : undefined,
      stLast?.riskComposite != null ? Number(stLast.riskComposite) : undefined,
    );

    const riskEngineHistory = {
      composite: stThis?.riskComposite != null ? Number(stThis.riskComposite) : null,
      category: stThis?.riskCategory != null ? String(stThis.riskCategory) : null,
      reasons: Array.isArray(stThis?.riskReasons) ? (stThis.riskReasons as string[]) : [],
      stability: stThis?.riskStability != null ? Number(stThis.riskStability) : null,
      deltas: (stThis?.riskDeltas as Record<string, unknown> | null) ?? null,
    };

    const interventionsFromAi = await this.getInterventions(studentId);

    const current = {
      performance: Math.round(meanTimeline(a.scoreTimeline ?? []) * 10) / 10,
      attendance: Math.round(meanTimeline(a.attendanceTimeline ?? []) * 1000) / 1000,
      engagement: a.engagementScore ?? 0,
      riskScore: r.overall,
      riskTier: riskTierLabel(r.level),
    };

    const aiSummary = await this.intelligenceEngine.aiTrySummary("/generate-student360-summary", {
      schoolId,
      studentId,
      deltas: { performanceDelta, attendanceDelta, engagementDelta, riskDelta },
      current,
      interventionCount,
      interventions: interventionsFromAi,
      riskEngine: engineRisk,
      riskEngineHistory,
    });

    return {
      studentId,
      identity,
      classes,
      teachers,
      assessments,
      scoreTimeline: a.scoreTimeline ?? [],
      attendanceTimeline: a.attendanceTimeline ?? [],
      submissionRate: a.submissionRate ?? 0,
      performanceDelta,
      attendanceDelta,
      engagementDelta,
      riskDelta,
      riskCompositeDelta,
      current,
      riskEngine: {
        compositeRisk: engineRisk.compositeRisk,
        category: engineRisk.category,
        reasons: engineRisk.reasons,
      },
      riskEngineHistory,
      interventionCount,
      interventions: interventionsFromAi,
      heatmap: { daily: hm.heatmap, weekly: hm.weekly },
      aiSummary,
    };
  }

  async getClass360(schoolId: string, classId: string, user: JwtPayload): Promise<Class360DashboardResponse> {
    const [header, studentRows] = await Promise.all([
      this.sqlClass360Header(schoolId, classId),
      this.sqlClass360StudentRows(schoolId, classId),
    ]);
    if (!header) throw new NotFoundException("Class not found");
    const primaryTeacherId = header.primaryTeacherId != null ? String(header.primaryTeacherId) : null;
    if (user.role === UserRole.TEACHER && user.teacherId && primaryTeacherId !== user.teacherId) {
      throw new ForbiddenException("You can only access your own classes");
    }

    const scoped =
      user.role === UserRole.TEACHER && user.teacherId
        ? asTeacherJwt(user, schoolId, user.teacherId)
        : toPrincipalScope(user, schoolId);

    const now = new Date();
    const thisWeekMonday = mondayUtcContaining(now);
    const lastWeekMonday = new Date(thisWeekMonday);
    lastWeekMonday.setUTCDate(lastWeekMonday.getUTCDate() - 7);

    const [classThisRow, classLastRow, analytics, classRisk, engineAgg] = await Promise.all([
      this.sqlWeeklyClassSnap(schoolId, classId, thisWeekMonday),
      this.sqlWeeklyClassSnap(schoolId, classId, lastWeekMonday),
      this.analytics.getClassAnalytics(classId, scoped),
      this.risk.getClassRisk(schoolId, classId, scoped),
      this.getClassRiskEngine(classId),
    ]);

    const snapThis = classThisRow
      ? {
          weekStartDate: (
            classThisRow.weekStartDate instanceof Date
              ? classThisRow.weekStartDate
              : new Date(String(classThisRow.weekStartDate))
          ).toISOString(),
          performance: classThisRow.performance != null ? Number(classThisRow.performance) : null,
          attendance: classThisRow.attendance != null ? Number(classThisRow.attendance) : null,
          engagement: classThisRow.engagement != null ? Number(classThisRow.engagement) : null,
          riskScore: classThisRow.riskScore != null ? Number(classThisRow.riskScore) : null,
          riskComposite: classThisRow.riskComposite != null ? Number(classThisRow.riskComposite) : null,
          riskCategory: classThisRow.riskCategory != null ? String(classThisRow.riskCategory) : null,
        }
      : null;
    const snapLast = classLastRow
      ? {
          weekStartDate: (
            classLastRow.weekStartDate instanceof Date
              ? classLastRow.weekStartDate
              : new Date(String(classLastRow.weekStartDate))
          ).toISOString(),
          performance: classLastRow.performance != null ? Number(classLastRow.performance) : null,
          attendance: classLastRow.attendance != null ? Number(classLastRow.attendance) : null,
          engagement: classLastRow.engagement != null ? Number(classLastRow.engagement) : null,
          riskScore: classLastRow.riskScore != null ? Number(classLastRow.riskScore) : null,
          riskComposite: classLastRow.riskComposite != null ? Number(classLastRow.riskComposite) : null,
          riskCategory: classLastRow.riskCategory != null ? String(classLastRow.riskCategory) : null,
        }
      : null;

    const performanceDelta = deltaPerformance(
      classThisRow?.performance != null ? Number(classThisRow.performance) : undefined,
      classLastRow?.performance != null ? Number(classLastRow.performance) : undefined,
    );
    const attendanceDelta = deltaAttendance(
      classThisRow?.attendance != null ? Number(classThisRow.attendance) : undefined,
      classLastRow?.attendance != null ? Number(classLastRow.attendance) : undefined,
    );
    const engagementDelta = deltaEngagement(
      classThisRow?.engagement != null ? Number(classThisRow.engagement) : undefined,
      classLastRow?.engagement != null ? Number(classLastRow.engagement) : undefined,
    );
    const riskDelta = deltaRisk(
      classThisRow?.riskScore != null ? Number(classThisRow.riskScore) : undefined,
      classLastRow?.riskScore != null ? Number(classLastRow.riskScore) : undefined,
    );
    const riskCompositeDelta = deltaCompositeRisk(
      classThisRow?.riskComposite != null ? Number(classThisRow.riskComposite) : undefined,
      classLastRow?.riskComposite != null ? Number(classLastRow.riskComposite) : undefined,
    );

    const ptDeleted = header.ptDeletedAt != null;
    const teacher =
      header.ptId != null && !ptDeleted
        ? {
            id: String(header.ptId),
            name:
              (header.ptDisplayName != null && String(header.ptDisplayName).trim()
                ? String(header.ptDisplayName).trim()
                : [header.ptGivenName, header.ptFamilyName].filter(Boolean).join(" ").trim()) || "Teacher",
            email: header.ptEmail != null ? String(header.ptEmail) : null,
          }
        : null;

    const students = studentRows.map((row) => {
      const sid = String(row.sid);
      const displayName =
        row.displayName != null && String(row.displayName).trim()
          ? String(row.displayName).trim()
          : [row.givenName, row.familyName].filter(Boolean).join(" ").trim() || sid;
      return {
        id: sid,
        displayName,
        gradeLevel: row.gradeLevel != null ? String(row.gradeLevel) : null,
        riskScore: row.riskScore != null ? Number(row.riskScore) : null,
      };
    });

    const termStarts = header.termStartsOn;
    const termEnds = header.termEndsOn;
    const startsOn =
      termStarts instanceof Date ? termStarts.toISOString().slice(0, 10) : String(termStarts).slice(0, 10);
    const endsOn =
      termEnds instanceof Date ? termEnds.toISOString().slice(0, 10) : String(termEnds).slice(0, 10);

    return {
      classInfo: {
        id: String(header.id),
        name: String(header.name),
        sectionCode: header.sectionCode != null ? String(header.sectionCode) : null,
        room: header.room != null ? String(header.room) : null,
      },
      teacher,
      subject: {
        id: String(header.subjectId),
        code: String(header.subjectCode),
        name: String(header.subjectName),
      },
      term: {
        id: String(header.termId),
        label: String(header.termLabel),
        startsOn,
        endsOn,
      },
      students,
      studentCount: students.length,
      averageScore: analytics.averageScore,
      submissionRate: analytics.submissionRate,
      scoreTrend: analytics.scoreTrend ?? [],
      riskSummary: {
        liveOverall: classRisk.overall,
        liveLevel: riskTierLabel(classRisk.level),
        liveEngagementRisk: classRisk.engagement,
        liveAttendanceRisk: classRisk.attendance,
        livePerformanceRisk: classRisk.performance,
        averageEngineRisk: engineAgg.classRisk,
        studentsLow: engineAgg.distribution.low,
        studentsMedium: engineAgg.distribution.medium,
        studentsHigh: engineAgg.distribution.high,
        snapshotThisWeek: snapThis,
        snapshotLastWeek: snapLast,
        deltas: {
          performance: performanceDelta,
          attendance: attendanceDelta,
          engagement: engagementDelta,
          risk: riskDelta,
          riskComposite: riskCompositeDelta,
        },
      },
      attendanceSummary: {
        currentRate: analytics.attendanceRate,
        snapshotThisWeek: classThisRow?.attendance != null ? Number(classThisRow.attendance) : null,
        snapshotLastWeek: classLastRow?.attendance != null ? Number(classLastRow.attendance) : null,
        delta: attendanceDelta,
      },
      engagementSummary: {
        currentScore: analytics.engagementScore,
        snapshotThisWeek: classThisRow?.engagement != null ? Number(classThisRow.engagement) : null,
        snapshotLastWeek: classLastRow?.engagement != null ? Number(classLastRow.engagement) : null,
        delta: engagementDelta,
      },
    };
  }

  /** NEW: Class-level risk using the Risk Engine */
  async getClassRiskEngine(classId: string) {
    const rows = await this.sqlStudentsForClassRiskEngine(classId);

    const inputs: RiskInput[] = rows.map((s) => ({
      studentId: String(s.id),
      classId,
      performance: Number(s.performance ?? 0),
      attendance: Number(s.attendance ?? 0),
      engagement: Number(s.engagement ?? 0),
      riskScore: Number(s.riskScore ?? 0),
      deltas: (s.deltas as RiskInput["deltas"]) ?? { performance: 0, attendance: 0, engagement: 0, risk: 0 },
      tiers: (s.tiers as RiskInput["tiers"]) ?? { performance: 1, attendance: 1, engagement: 1, risk: 1 },
      flags:
        (s.flags as RiskInput["flags"]) ?? {
          lowPerformance: false,
          lowAttendance: false,
          lowEngagement: false,
          highRisk: false,
        },
      stability: Number(s.stability ?? 0),
    }));

    return this.risk.getClassRiskEngine(inputs);
  }
}
