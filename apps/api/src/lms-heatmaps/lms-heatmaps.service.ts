import { HttpService } from "@nestjs/axios";
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AxiosError } from "axios";
import type { RowDataPacket } from "mysql2/promise";
import { firstValueFrom } from "rxjs";
import { UserRole } from "../common/user-role";
import type { JwtPayload } from "../common/types/jwt-payload";
import { aiHttpHeaders } from "../integrations/ai-request-headers";
import { MySQLService } from "../database/mysql.service";
import type { HeatmapCell } from "./dto/heatmap-cell.dto";
import type { ClassHeatmapResponse } from "./dto/class-heatmap.dto";
import type { GradeHeatmapResponse } from "./dto/grade-heatmap.dto";
import type { SchoolHeatmapResponse } from "./dto/school-heatmap.dto";
import type { StudentHeatmapResponse } from "./dto/student-heatmap.dto";
import type { SubjectHeatmapResponse } from "./dto/subject-heatmap.dto";

type IdRow = RowDataPacket & { id: string };

type StudentIdRow = RowDataPacket & { studentId: string };

type LmsEventRow = RowDataPacket & { occurredAt: Date; eventType: string };

type StudentGradeRow = RowDataPacket & { id: string; gradeLevel: string | null };

function toUtcYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Monday UTC of the ISO week containing `d`. */
function weekStartKey(d: Date): string {
  const x = new Date(d);
  const day = x.getUTCDay();
  const diff = (day + 6) % 7;
  x.setUTCDate(x.getUTCDate() - diff);
  x.setUTCHours(0, 0, 0, 0);
  return toUtcYmd(x);
}

function monthStartKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function normalizeGradeKey(gradeLevel: string | null | undefined): string {
  const g = (gradeLevel ?? "").trim();
  return g.length ? g : "_unassigned";
}

function defaultDateRange(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 365);
  return { from, to };
}

function parseOptionalDate(s: string | undefined): Date | undefined {
  if (!s?.trim()) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

@Injectable()
export class LmsHeatmapsService {
  private readonly logger = new Logger(LmsHeatmapsService.name);

  constructor(
    private readonly db: MySQLService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private getAiBaseUrl(): string {
    return (this.config.get<string>("AI_SERVICE_URL") ?? "http://ai:8000").replace(/\/$/, "");
  }

  /** AND (…) matching teacher-scoped LMS filters merged into event queries. */
  private teacherLmsEventScopeSql(alias: string, teacherId: string): { sql: string; params: unknown[] } {
    return {
      sql: ` AND (
        (${alias}.class_id IS NULL AND EXISTS (
          SELECT 1 FROM enrollments en
          INNER JOIN classes c ON c.id = en.class_id AND c.deleted_at IS NULL
          WHERE en.student_id = ${alias}.student_id
            AND en.school_id = ${alias}.school_id
            AND en.deleted_at IS NULL
            AND en.status = 'active'
            AND c.primary_teacher_id = ?
        ))
        OR EXISTS (
          SELECT 1 FROM classes c
          WHERE c.id = ${alias}.class_id AND c.deleted_at IS NULL AND c.primary_teacher_id = ?
        )
      )`,
      params: [teacherId, teacherId],
    };
  }

  private async tryAiSummary(payload: Record<string, unknown>): Promise<string | null> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ summary?: string }>(`${this.getAiBaseUrl()}/generate-lms-heatmap-summary`, payload, {
          headers: aiHttpHeaders(this.config),
          timeout: this.config.get<number>("AI_SERVICE_TIMEOUT_MS") ?? 60_000,
        }),
      );
      const s = res.data?.summary;
      return typeof s === "string" ? s : null;
    } catch (err) {
      if (err instanceof AxiosError) {
        this.logger.warn(`LMS heatmap AI failed: ${err.response?.status ?? err.code}`);
      } else {
        this.logger.warn(`LMS heatmap AI failed: ${err instanceof Error ? err.message : err}`);
      }
      return null;
    }
  }

  private buildBuckets(
    events: { occurredAt: Date; eventType: string }[],
    mode: "day" | "week" | "month",
  ): HeatmapCell[] {
    const map = new Map<string, { count: number; eventTypes: Record<string, number> }>();
    for (const e of events) {
      const key =
        mode === "day"
          ? toUtcYmd(e.occurredAt)
          : mode === "week"
            ? weekStartKey(e.occurredAt)
            : monthStartKey(e.occurredAt);
      const cur = map.get(key) ?? { count: 0, eventTypes: {} };
      cur.count += 1;
      cur.eventTypes[e.eventType] = (cur.eventTypes[e.eventType] ?? 0) + 1;
      map.set(key, cur);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, count: v.count, eventTypes: v.eventTypes }));
  }

  private async fetchLmsEvents(
    schoolId: string,
    user: JwtPayload,
    whereSql: string,
    whereParams: unknown[],
  ): Promise<{ occurredAt: Date; eventType: string }[]> {
    let sql = `
      SELECT e.occurred_at AS occurredAt, e.event_type AS eventType
      FROM lms_activity_events e
      WHERE e.school_id = ?
        AND e.deleted_at IS NULL
        AND ${whereSql}
    `;
    const params: unknown[] = [schoolId, ...whereParams];
    if (user.role === UserRole.TEACHER && user.teacherId) {
      const t = this.teacherLmsEventScopeSql("e", user.teacherId);
      sql += t.sql;
      params.push(...t.params);
    }
    const packet = (await this.db.query(sql, params))[0] as LmsEventRow[];
    const rows = packet as LmsEventRow[];
    return rows.map((r) => ({ occurredAt: r.occurredAt, eventType: r.eventType }));
  }

  private async assertStudentInScope(studentId: string, user: JwtPayload): Promise<boolean> {
    if (user.role === UserRole.TEACHER && user.teacherId) {
      const sql = `
        SELECT s.id FROM students s
        WHERE s.id = ? AND s.school_id = ? AND s.deleted_at IS NULL
          AND EXISTS (
            SELECT 1 FROM enrollments e
            INNER JOIN classes c ON c.id = e.class_id AND c.deleted_at IS NULL
            WHERE e.student_id = s.id AND e.school_id = s.school_id
              AND e.deleted_at IS NULL AND e.status = 'active'
              AND c.primary_teacher_id = ?
          )
        LIMIT 1
      `;
      const packet = (await this.db.query(sql, [
        studentId,
        user.schoolId,
        user.teacherId,
      ]))[0] as RowDataPacket[];
      return !!(packet as RowDataPacket[])[0];
    }
    const sql = `SELECT id FROM students WHERE id = ? AND school_id = ? AND deleted_at IS NULL LIMIT 1`;
    const packet = (await this.db.query(sql, [studentId, user.schoolId]))[0] as RowDataPacket[];
    return !!(packet as RowDataPacket[])[0];
  }

  private async assertClassInScope(classId: string, user: JwtPayload): Promise<boolean> {
    if (user.role === UserRole.TEACHER && user.teacherId) {
      const sql = `
        SELECT id FROM classes
        WHERE id = ? AND school_id = ? AND deleted_at IS NULL AND primary_teacher_id = ?
        LIMIT 1
      `;
      const packet = (await this.db.query(sql, [
        classId,
        user.schoolId,
        user.teacherId,
      ]))[0] as RowDataPacket[];
      return !!(packet as RowDataPacket[])[0];
    }
    const sql = `SELECT id FROM classes WHERE id = ? AND school_id = ? AND deleted_at IS NULL LIMIT 1`;
    const packet = (await this.db.query(sql, [classId, user.schoolId]))[0] as RowDataPacket[];
    return !!(packet as RowDataPacket[])[0];
  }

  private async teacherStudentIdSet(user: JwtPayload): Promise<Set<string> | null> {
    if (user.role !== UserRole.TEACHER || !user.teacherId) return null;
    const sql = `
      SELECT DISTINCT e.student_id AS studentId
      FROM enrollments e
      INNER JOIN classes c ON c.id = e.class_id AND c.deleted_at IS NULL
      WHERE e.school_id = ?
        AND e.deleted_at IS NULL
        AND e.status = 'active'
        AND c.primary_teacher_id = ?
    `;
    const packet = (await this.db.query(sql, [user.schoolId, user.teacherId]))[0] as StudentIdRow[];
    const rows = packet as StudentIdRow[];
    return new Set(rows.map((r) => r.studentId));
  }

  async getStudentHeatmap(
    schoolId: string,
    studentId: string,
    user: JwtPayload,
    from?: string,
    to?: string,
  ): Promise<StudentHeatmapResponse> {
    const stOk = await this.assertStudentInScope(studentId, user);
    if (!stOk) throw new NotFoundException("Student not found");

    const { from: f0, to: t0 } = defaultDateRange();
    const f = parseOptionalDate(from) ?? f0;
    const t = parseOptionalDate(to) ?? t0;

    const whereSql = `e.student_id = ? AND e.occurred_at >= ? AND e.occurred_at <= ?`;
    const events = await this.fetchLmsEvents(schoolId, user, whereSql, [studentId, f, t]);
    const heatmap = this.buildBuckets(events, "day");
    const weekly = this.buildBuckets(events, "week");
    const monthly = this.buildBuckets(events, "month");

    const aiSummary = await this.tryAiSummary({
      scope: "student",
      schoolId,
      studentId,
      daily: heatmap,
      weekly,
      monthly,
    });

    return { studentId, heatmap, weekly, monthly, aiSummary };
  }

  async getClassHeatmap(
    schoolId: string,
    classId: string,
    user: JwtPayload,
    from?: string,
    to?: string,
  ): Promise<ClassHeatmapResponse> {
    const clsOk = await this.assertClassInScope(classId, user);
    if (!clsOk) throw new NotFoundException("Class not found");

    const { from: f0, to: t0 } = defaultDateRange();
    const f = parseOptionalDate(from) ?? f0;
    const t = parseOptionalDate(to) ?? t0;

    const whereSql = `e.class_id = ? AND e.occurred_at >= ? AND e.occurred_at <= ?`;
    const events = await this.fetchLmsEvents(schoolId, user, whereSql, [classId, f, t]);
    const heatmap = this.buildBuckets(events, "day");
    const weekly = this.buildBuckets(events, "week");
    const monthly = this.buildBuckets(events, "month");

    const aiSummary = await this.tryAiSummary({
      scope: "class",
      schoolId,
      classId,
      daily: heatmap,
      weekly,
      monthly,
    });

    return { classId, heatmap, weekly, monthly, aiSummary };
  }

  private async fetchStudentsWithGrades(schoolId: string): Promise<StudentGradeRow[]> {
    const sql = `
      SELECT id, grade_level AS gradeLevel
      FROM students
      WHERE school_id = ? AND deleted_at IS NULL
    `;
    const packet = (await this.db.query(sql, [schoolId]))[0] as StudentGradeRow[];
    return packet as StudentGradeRow[];
  }

  async getGradeHeatmap(
    schoolId: string,
    gradeId: string,
    user: JwtPayload,
    from?: string,
    to?: string,
  ): Promise<GradeHeatmapResponse> {
    const key = decodeURIComponent(gradeId);
    const students = await this.fetchStudentsWithGrades(schoolId);
    let studentIds = students.filter((s) => normalizeGradeKey(s.gradeLevel) === key).map((s) => s.id);

    const allowed = await this.teacherStudentIdSet(user);
    if (allowed) {
      studentIds = studentIds.filter((id) => allowed.has(id));
    }

    if (!studentIds.length) {
      return {
        gradeId: key,
        heatmap: [],
        weekly: [],
        monthly: [],
        aiSummary: null,
      };
    }

    const { from: f0, to: t0 } = defaultDateRange();
    const f = parseOptionalDate(from) ?? f0;
    const t = parseOptionalDate(to) ?? t0;

    const ph = studentIds.map(() => "?").join(", ");
    const whereSql = `e.student_id IN (${ph}) AND e.occurred_at >= ? AND e.occurred_at <= ?`;
    const events = await this.fetchLmsEvents(schoolId, user, whereSql, [...studentIds, f, t]);
    const heatmap = this.buildBuckets(events, "day");
    const weekly = this.buildBuckets(events, "week");
    const monthly = this.buildBuckets(events, "month");

    const aiSummary = await this.tryAiSummary({
      scope: "grade",
      schoolId,
      gradeId: key,
      daily: heatmap,
      weekly,
      monthly,
    });

    return { gradeId: key, heatmap, weekly, monthly, aiSummary };
  }

  async getSubjectHeatmap(
    schoolId: string,
    subjectId: string,
    user: JwtPayload,
    from?: string,
    to?: string,
  ): Promise<SubjectHeatmapResponse> {
    const subSql = `SELECT id FROM subjects WHERE id = ? AND school_id = ? AND deleted_at IS NULL LIMIT 1`;
    const subPacket = (await this.db.query(subSql, [subjectId, schoolId]))[0] as IdRow[];
    if (!(subPacket as IdRow[])[0]) throw new NotFoundException("Subject not found");

    let classSql = `
      SELECT id FROM classes
      WHERE school_id = ? AND subject_id = ? AND deleted_at IS NULL
    `;
    const classParams: unknown[] = [schoolId, subjectId];
    if (user.role === UserRole.TEACHER && user.teacherId) {
      classSql += ` AND primary_teacher_id = ?`;
      classParams.push(user.teacherId);
    }
    const classPacket = (await this.db.query(classSql, classParams))[0] as IdRow[];
    const classIds = (classPacket as IdRow[]).map((c) => c.id);

    let enrolledStudentIds: string[] = [];
    if (classIds.length) {
      const placeholders = classIds.map(() => "?").join(", ");
      const enSql = `
        SELECT DISTINCT e.student_id AS studentId
        FROM enrollments e
        WHERE e.school_id = ?
          AND e.deleted_at IS NULL
          AND e.status = 'active'
          AND e.class_id IN (${placeholders})
      `;
      const enPacket = (await this.db.query(enSql, [schoolId, ...classIds]))[0] as StudentIdRow[];
      enrolledStudentIds = (enPacket as StudentIdRow[]).map((r) => r.studentId);
    }

    const { from: f0, to: t0 } = defaultDateRange();
    const f = parseOptionalDate(from) ?? f0;
    const t = parseOptionalDate(to) ?? t0;

    if (!classIds.length && !enrolledStudentIds.length) {
      return {
        subjectId,
        heatmap: [],
        weekly: [],
        monthly: [],
        aiSummary: null,
      };
    }

    const orParts: string[] = [];
    const orParams: unknown[] = [];
    if (classIds.length) {
      orParts.push(`e.class_id IN (${classIds.map(() => "?").join(", ")})`);
      orParams.push(...classIds);
    }
    if (enrolledStudentIds.length) {
      orParts.push(
        `(e.class_id IS NULL AND e.student_id IN (${enrolledStudentIds.map(() => "?").join(", ")}))`,
      );
      orParams.push(...enrolledStudentIds);
    }
    const whereSql = `(${orParts.join(" OR ")}) AND e.occurred_at >= ? AND e.occurred_at <= ?`;
    const events = await this.fetchLmsEvents(schoolId, user, whereSql, [...orParams, f, t]);
    const heatmap = this.buildBuckets(events, "day");
    const weekly = this.buildBuckets(events, "week");
    const monthly = this.buildBuckets(events, "month");

    const aiSummary = await this.tryAiSummary({
      scope: "subject",
      schoolId,
      subjectId,
      daily: heatmap,
      weekly,
      monthly,
    });

    return { subjectId, heatmap, weekly, monthly, aiSummary };
  }

  async getSchoolHeatmap(
    schoolId: string,
    user: JwtPayload,
    from?: string,
    to?: string,
  ): Promise<SchoolHeatmapResponse> {
    if (user.schoolId !== schoolId) {
      throw new ForbiddenException("School mismatch");
    }

    const { from: f0, to: t0 } = defaultDateRange();
    const f = parseOptionalDate(from) ?? f0;
    const t = parseOptionalDate(to) ?? t0;

    const whereSql = `e.occurred_at >= ? AND e.occurred_at <= ?`;
    const events = await this.fetchLmsEvents(schoolId, user, whereSql, [f, t]);
    const heatmap = this.buildBuckets(events, "day");
    const weekly = this.buildBuckets(events, "week");
    const monthly = this.buildBuckets(events, "month");

    const aiSummary = await this.tryAiSummary({
      scope: "school",
      schoolId,
      daily: heatmap,
      weekly,
      monthly,
    });

    return { schoolId, heatmap, weekly, monthly, aiSummary };
  }
}
