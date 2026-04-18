import { HttpService } from "@nestjs/axios";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { AxiosError } from "axios";
import type { RowDataPacket } from "mysql2/promise";
import { firstValueFrom } from "rxjs";
import { AnalyticsService } from "../analytics/analytics.service";
import { aiHttpHeaders } from "../integrations/ai-request-headers";
import type { TrendPoint } from "../analytics/dto/common.dto";
import { UserRole } from "../common/user-role";
import type { JwtPayload } from "../common/types/jwt-payload";
import { MySQLService } from "../database/mysql.service";
import { RiskService } from "../risk/risk.service";
import type { CreateInterventionDto } from "./dto/create-intervention.dto";
import type { InterventionResponseDto } from "./dto/intervention-response.dto";
import type { UpdateInterventionDto } from "./dto/update-intervention.dto";

const PRESENT_LIKE = new Set(["present", "late", "excused"]);

type InterventionRow = RowDataPacket & {
  id: string;
  schoolId: string;
  teacherId: string;
  classId: string | null;
  studentId: string | null;
  triggerType: string;
  description: string;
  notes: string | null;
  recommendations: unknown;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type ClassListRow = RowDataPacket & {
  id: string;
  primaryTeacherId: string | null;
  name: string;
};

type StudentIdRow = RowDataPacket & { id: string };

type PrimaryTeacherRow = RowDataPacket & { primaryTeacherId: string | null };

type AvgRow = RowDataPacket & { avgEng: number | null };

function toPrincipalScope(user: JwtPayload, schoolId: string): JwtPayload {
  return {
    sub: user.sub,
    email: user.email,
    schoolId,
    role: UserRole.PRINCIPAL,
    teacherId: null,
  };
}

function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function meanTrendInRange(points: TrendPoint[], start: Date, endExclusive: Date): number | null {
  const vals: number[] = [];
  const startT = start.getTime();
  const endT = endExclusive.getTime();
  for (const p of points) {
    const t = parseDay(p.date).getTime();
    if (t >= startT && t < endT && Number.isFinite(p.value)) vals.push(p.value);
  }
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function jsonParam(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  return JSON.stringify(v);
}

@Injectable()
export class InterventionsService {
  private readonly logger = new Logger(InterventionsService.name);

  constructor(
    private readonly db: MySQLService,
    private readonly analytics: AnalyticsService,
    private readonly risk: RiskService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private getAiBaseUrl(): string {
    return (this.config.get<string>("AI_SERVICE_URL") ?? "http://ai:8000").replace(/\/$/, "");
  }

  toResponse(row: InterventionRow): InterventionResponseDto {
    return {
      id: row.id,
      schoolId: row.schoolId,
      teacherId: row.teacherId,
      classId: row.classId,
      studentId: row.studentId,
      triggerType: row.triggerType,
      description: row.description,
      recommendations: row.recommendations ?? null,
      status: row.status,
      notes: row.notes ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private assertTeacherOwnsIntervention(user: JwtPayload, teacherId: string): void {
    if (user.role === UserRole.TEACHER && user.teacherId !== teacherId) {
      throw new ForbiddenException("Cannot access another teacher's intervention");
    }
  }

  private async tryAiRecommendations(payload: Record<string, unknown>): Promise<unknown | null> {
    try {
      const url = `${this.getAiBaseUrl()}/generate-intervention-recommendations`;
      const res = await firstValueFrom(
        this.http.post<unknown>(url, payload, {
          headers: aiHttpHeaders(this.config),
          timeout: this.config.get<number>("AI_SERVICE_TIMEOUT_MS") ?? 60_000,
        }),
      );
      return res.data ?? null;
    } catch (err) {
      if (err instanceof AxiosError) {
        this.logger.warn(`AI recommendations failed: ${err.response?.status ?? err.code}`);
      } else {
        this.logger.warn(`AI recommendations failed: ${err instanceof Error ? err.message : err}`);
      }
      return null;
    }
  }

  private async fetchInterventionById(schoolId: string, id: string): Promise<InterventionRow | null> {
    const sql = `
      SELECT id,
             school_id AS schoolId,
             teacher_id AS teacherId,
             class_id AS classId,
             student_id AS studentId,
             trigger_type AS triggerType,
             description,
             notes,
             recommendations,
             status,
             created_at AS createdAt,
             updated_at AS updatedAt
      FROM interventions
      WHERE id = ? AND school_id = ?
      LIMIT 1
    `;
    const packet = (await this.db.query(sql, [id, schoolId]))[0] as InterventionRow[];
    const rows = packet as InterventionRow[];
    return rows[0] ?? null;
  }

  private async validateEntities(
    schoolId: string,
    teacherId: string,
    classId: string | undefined,
    studentId: string | undefined,
  ): Promise<void> {
    const tSql = `SELECT id FROM teachers WHERE id = ? AND school_id = ? AND deleted_at IS NULL LIMIT 1`;
    const tPacket = (await this.db.query(tSql, [teacherId, schoolId]))[0] as RowDataPacket[];
    const tRows = tPacket as RowDataPacket[];
    if (!tRows[0]) throw new BadRequestException("Teacher not found in this school");

    if (classId) {
      const cSql = `SELECT id FROM classes WHERE id = ? AND school_id = ? AND deleted_at IS NULL LIMIT 1`;
      const cPacket = (await this.db.query(cSql, [classId, schoolId]))[0] as RowDataPacket[];
      const cRows = cPacket as RowDataPacket[];
      if (!cRows[0]) throw new BadRequestException("Class not found in this school");
    }
    if (studentId) {
      const sSql = `SELECT id FROM students WHERE id = ? AND school_id = ? AND deleted_at IS NULL LIMIT 1`;
      const sPacket = (await this.db.query(sSql, [studentId, schoolId]))[0] as RowDataPacket[];
      const sRows = sPacket as RowDataPacket[];
      if (!sRows[0]) throw new BadRequestException("Student not found in this school");
    }
  }

  async createIntervention(
    schoolId: string,
    dto: CreateInterventionDto,
    user: JwtPayload,
  ): Promise<InterventionResponseDto> {
    if (user.role === UserRole.TEACHER) {
      if (!user.teacherId || user.teacherId !== dto.teacherId) {
        throw new ForbiddenException("Teachers can only create interventions for themselves");
      }
    }

    await this.validateEntities(schoolId, dto.teacherId, dto.classId, dto.studentId);

    const aiPayload = {
      schoolId,
      teacherId: dto.teacherId,
      classId: dto.classId ?? null,
      studentId: dto.studentId ?? null,
      triggerType: dto.triggerType,
      description: dto.description,
    };
    const recommendations = await this.tryAiRecommendations(aiPayload);

    const id = randomUUID();
    const insertSql = `
      INSERT INTO interventions (
        id, school_id, teacher_id, class_id, student_id,
        trigger_type, description, recommendations, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), 'open', NOW(3), NOW(3))
    `;
    const recJson = jsonParam(recommendations);
    await this.db.query(insertSql, [
      id,
      schoolId,
      dto.teacherId,
      dto.classId ?? null,
      dto.studentId ?? null,
      dto.triggerType,
      dto.description,
      recJson,
    ]);

    const row = await this.fetchInterventionById(schoolId, id);
    if (!row) throw new NotFoundException("Intervention not found after create");
    return this.toResponse(row);
  }

  async listInterventions(schoolId: string, user: JwtPayload): Promise<InterventionResponseDto[]> {
    let sql = `
      SELECT id,
             school_id AS schoolId,
             teacher_id AS teacherId,
             class_id AS classId,
             student_id AS studentId,
             trigger_type AS triggerType,
             description,
             notes,
             recommendations,
             status,
             created_at AS createdAt,
             updated_at AS updatedAt
      FROM interventions
      WHERE school_id = ?
    `;
    const params: unknown[] = [schoolId];
    if (user.role === UserRole.TEACHER) {
      if (!user.teacherId) return [];
      sql += ` AND teacher_id = ?`;
      params.push(user.teacherId);
    }
    sql += ` ORDER BY created_at DESC`;
    const packet = (await this.db.query(sql, params))[0] as InterventionRow[];
    const rows = packet as InterventionRow[];
    return rows.map((r) => this.toResponse(r));
  }

  async getIntervention(schoolId: string, id: string, user: JwtPayload): Promise<InterventionResponseDto> {
    const row = await this.fetchInterventionById(schoolId, id);
    if (!row) throw new NotFoundException("Intervention not found");
    this.assertTeacherOwnsIntervention(user, row.teacherId);
    return this.toResponse(row);
  }

  async updateIntervention(
    schoolId: string,
    id: string,
    dto: UpdateInterventionDto,
    user: JwtPayload,
  ): Promise<InterventionResponseDto> {
    const row = await this.fetchInterventionById(schoolId, id);
    if (!row) throw new NotFoundException("Intervention not found");
    this.assertTeacherOwnsIntervention(user, row.teacherId);

    const sets: string[] = [];
    const params: unknown[] = [];
    if (dto.status !== undefined) {
      sets.push("status = ?");
      params.push(dto.status);
    }
    if (dto.notes !== undefined) {
      sets.push("notes = ?");
      params.push(dto.notes);
    }
    if (dto.recommendations !== undefined) {
      sets.push("recommendations = CAST(? AS JSON)");
      params.push(jsonParam(dto.recommendations));
    }
    if (!sets.length) {
      return this.toResponse(row);
    }
    sets.push("updated_at = NOW(3)");
    params.push(id, schoolId);
    const updateSql = `UPDATE interventions SET ${sets.join(", ")} WHERE id = ? AND school_id = ?`;
    await this.db.query(updateSql, params);

    const updated = await this.fetchInterventionById(schoolId, id);
    if (!updated) throw new NotFoundException("Intervention not found");
    return this.toResponse(updated);
  }

  private async hasOpenDuplicate(
    schoolId: string,
    teacherId: string,
    classId: string | null,
    studentId: string | null,
    triggerType: string,
  ): Promise<boolean> {
    const sql = `
      SELECT id FROM interventions
      WHERE school_id = ?
        AND teacher_id = ?
        AND trigger_type = ?
        AND status IN ('open', 'in_progress')
        AND class_id <=> ?
        AND student_id <=> ?
      LIMIT 1
    `;
    const packet = (await this.db.query(sql, [
      schoolId,
      teacherId,
      triggerType,
      classId,
      studentId,
    ]))[0] as RowDataPacket[];
    const existing = packet as RowDataPacket[];
    return !!existing[0];
  }

  private async createAuto(
    schoolId: string,
    teacherId: string,
    classId: string | null,
    studentId: string | null,
    triggerType: string,
    description: string,
    details: Record<string, unknown>,
  ): Promise<boolean> {
    if (await this.hasOpenDuplicate(schoolId, teacherId, classId, studentId, triggerType)) {
      return false;
    }
    const recommendations = await this.tryAiRecommendations({
      schoolId,
      teacherId,
      classId,
      studentId,
      triggerType,
      description,
      details,
    });
    const id = randomUUID();
    const insertSql = `
      INSERT INTO interventions (
        id, school_id, teacher_id, class_id, student_id,
        trigger_type, description, recommendations, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), 'open', NOW(3), NOW(3))
    `;
    await this.db.query(insertSql, [
      id,
      schoolId,
      teacherId,
      classId,
      studentId,
      triggerType,
      description,
      jsonParam(recommendations),
    ]);
    return true;
  }

  async autoCheck(schoolId: string, user: JwtPayload): Promise<{
    created: number;
    skippedDuplicates: number;
    failedChecks: number;
    riskClass: number;
    riskStudent: number;
    attendanceDrop: number;
    engagementDrop: number;
    classScoreDrop: number;
    classAttendanceDrop: number;
  }> {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.PRINCIPAL) {
      throw new ForbiddenException("Only administrators can run school-wide auto-check");
    }
    if (user.schoolId !== schoolId) {
      throw new ForbiddenException("School mismatch");
    }

    const scoped = toPrincipalScope(user, schoolId);
    let created = 0;
    let skippedDuplicates = 0;
    let failedChecks = 0;
    let riskClass = 0;
    let riskStudent = 0;
    let attendanceDrop = 0;
    let engagementDrop = 0;
    let classScoreDrop = 0;
    let classAttendanceDrop = 0;

    const now = new Date();
    const last7Start = new Date(now);
    last7Start.setUTCDate(last7Start.getUTCDate() - 7);
    const prev7Start = new Date(now);
    prev7Start.setUTCDate(prev7Start.getUTCDate() - 14);

    const classesSql = `
      SELECT id, primary_teacher_id AS primaryTeacherId, name
      FROM classes
      WHERE school_id = ? AND deleted_at IS NULL
    `;
    const classesPacket = (await this.db.query(classesSql, [schoolId]))[0] as ClassListRow[];
    const classes = classesPacket as ClassListRow[];

    for (const c of classes) {
      if (!c.primaryTeacherId) continue;
      try {
        const r = await this.risk.getClassRisk(schoolId, c.id, scoped);
        if (r.overall > 70) {
          riskClass += 1;
          const ok = await this.createAuto(
            schoolId,
            c.primaryTeacherId,
            c.id,
            null,
            "auto_risk_class",
            `Class "${c.name}" overall risk score ${r.overall} exceeds threshold (70).`,
            { risk: r },
          );
          if (ok) created += 1;
          else skippedDuplicates += 1;
        }
      } catch {
        failedChecks += 1;
      }
    }

    const studentsSql = `SELECT id FROM students WHERE school_id = ? AND deleted_at IS NULL`;
    const studentsPacket = (await this.db.query(studentsSql, [schoolId]))[0] as StudentIdRow[];
    const students = studentsPacket as StudentIdRow[];

    const enrollmentSql = `
      SELECT c.primary_teacher_id AS primaryTeacherId
      FROM enrollments e
      INNER JOIN classes c ON c.id = e.class_id AND c.deleted_at IS NULL
      WHERE e.student_id = ?
        AND e.school_id = ?
        AND e.deleted_at IS NULL
        AND e.status = 'active'
        AND c.primary_teacher_id IS NOT NULL
      LIMIT 1
    `;

    for (const s of students) {
      const enPacket = (await this.db.query(enrollmentSql, [s.id, schoolId]))[0] as PrimaryTeacherRow[];
      const enRows = enPacket as PrimaryTeacherRow[];
      const teacherId = enRows[0]?.primaryTeacherId ?? null;
      if (!teacherId) {
        failedChecks += 1;
        continue;
      }

      try {
        const r = await this.risk.getStudentRisk(schoolId, s.id, scoped);
        if (r.overall > 70) {
          riskStudent += 1;
          const ok = await this.createAuto(
            schoolId,
            teacherId,
            null,
            s.id,
            "auto_risk_student",
            `Student overall risk score ${r.overall} exceeds threshold (70).`,
            { risk: r },
          );
          if (ok) created += 1;
          else skippedDuplicates += 1;
        }
      } catch {
        failedChecks += 1;
      }

      try {
        const a = await this.analytics.getStudentAnalytics(s.id, scoped);
        const lastAvg = meanTrendInRange(a.attendanceTimeline ?? [], last7Start, now);
        const prevAvg = meanTrendInRange(a.attendanceTimeline ?? [], prev7Start, last7Start);
        if (
          lastAvg != null &&
          prevAvg != null &&
          prevAvg > 0 &&
          (prevAvg - lastAvg) / prevAvg > 0.2
        ) {
          attendanceDrop += 1;
          const ok = await this.createAuto(
            schoolId,
            teacherId,
            null,
            s.id,
            "auto_attendance_drop",
            `Attendance rate dropped more than 20% vs prior 7 days (was ~${(prevAvg * 100).toFixed(0)}%, now ~${(lastAvg * 100).toFixed(0)}%).`,
            { prevAvg, lastAvg },
          );
          if (ok) created += 1;
          else skippedDuplicates += 1;
        }
      } catch {
        failedChecks += 1;
      }

      try {
        const lastEngSql = `
          SELECT AVG(engagement_score) AS avgEng
          FROM lms_activity_events
          WHERE school_id = ?
            AND student_id = ?
            AND deleted_at IS NULL
            AND occurred_at >= ?
        `;
        const prevEngSql = `
          SELECT AVG(engagement_score) AS avgEng
          FROM lms_activity_events
          WHERE school_id = ?
            AND student_id = ?
            AND deleted_at IS NULL
            AND occurred_at >= ?
            AND occurred_at < ?
        `;
        const lastPacket = (await this.db.query(lastEngSql, [schoolId, s.id, last7Start]))[0] as AvgRow[];
        const prevPacket = (await this.db.query(prevEngSql, [
          schoolId,
          s.id,
          prev7Start,
          last7Start,
        ]))[0] as AvgRow[];
        const lastRows = lastPacket as AvgRow[];
        const prevRows = prevPacket as AvgRow[];
        const last = lastRows[0]?.avgEng != null ? Number(lastRows[0].avgEng) : 0;
        const prev = prevRows[0]?.avgEng != null ? Number(prevRows[0].avgEng) : 0;
        if (prev > 0 && (prev - last) / prev > 0.2) {
          engagementDrop += 1;
          const ok = await this.createAuto(
            schoolId,
            teacherId,
            null,
            s.id,
            "auto_engagement_drop",
            `Average LMS engagement dropped more than 20% vs prior 7 days.`,
            { prevAvgEngagement: prev, lastAvgEngagement: last },
          );
          if (ok) created += 1;
          else skippedDuplicates += 1;
        }
      } catch {
        failedChecks += 1;
      }
    }

    for (const c of classes) {
      if (!c.primaryTeacherId) continue;
      try {
        const a = await this.analytics.getClassAnalytics(c.id, scoped);
        const lastAvg = meanTrendInRange(a.scoreTrend ?? [], last7Start, now);
        const prevAvg = meanTrendInRange(a.scoreTrend ?? [], prev7Start, last7Start);
        if (
          lastAvg != null &&
          prevAvg != null &&
          prevAvg > 0 &&
          (prevAvg - lastAvg) / prevAvg > 0.2
        ) {
          classScoreDrop += 1;
          const ok = await this.createAuto(
            schoolId,
            c.primaryTeacherId,
            c.id,
            null,
            "auto_class_score_drop",
            `Class average score trend dropped more than 20% vs prior 7 days.`,
            { prevAvg, lastAvg, className: c.name },
          );
          if (ok) created += 1;
          else skippedDuplicates += 1;
        }
      } catch {
        failedChecks += 1;
      }

      try {
        const prevAtt = await this.classAttendanceRateWindow(schoolId, c.id, prev7Start, last7Start);
        const lastAtt = await this.classAttendanceRateWindow(schoolId, c.id, last7Start, now);
        if (
          prevAtt != null &&
          lastAtt != null &&
          prevAtt > 0 &&
          (prevAtt - lastAtt) / prevAtt > 0.2
        ) {
          classAttendanceDrop += 1;
          const ok = await this.createAuto(
            schoolId,
            c.primaryTeacherId,
            c.id,
            null,
            "auto_class_attendance_drop",
            `Class attendance rate dropped more than 20% vs prior 7 days.`,
            { prevAtt, lastAtt },
          );
          if (ok) created += 1;
          else skippedDuplicates += 1;
        }
      } catch {
        failedChecks += 1;
      }
    }

    return {
      created,
      skippedDuplicates,
      failedChecks,
      riskClass,
      riskStudent,
      attendanceDrop,
      engagementDrop,
      classScoreDrop,
      classAttendanceDrop,
    };
  }

  private async classAttendanceRateWindow(
    schoolId: string,
    classId: string,
    from: Date,
    toExclusive: Date,
  ): Promise<number | null> {
    const sql = `
      SELECT status FROM attendance_records
      WHERE school_id = ?
        AND class_id = ?
        AND deleted_at IS NULL
        AND session_date >= ?
        AND session_date < ?
    `;
    const packet = (await this.db.query(sql, [schoolId, classId, from, toExclusive]))[0] as RowDataPacket[];
    const rows = packet as RowDataPacket[];
    if (!rows.length) return null;
    const present = rows.filter((r) => PRESENT_LIKE.has(String(r.status))).length;
    return present / rows.length;
  }
}
