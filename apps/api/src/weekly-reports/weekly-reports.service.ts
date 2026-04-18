import { HttpService } from "@nestjs/axios";
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserRole } from "../common/user-role";
import { AxiosError } from "axios";
import type { RowDataPacket } from "mysql2/promise";
import { firstValueFrom } from "rxjs";
import { AnalyticsService } from "../analytics/analytics.service";
import { aiHttpHeaders } from "../integrations/ai-request-headers";
import type { JwtPayload } from "../common/types/jwt-payload";
import { MySQLService } from "../database/mysql.service";
import { RiskService } from "../risk/risk.service";
import type { StudentAttentionSummary } from "./dto/student-attention-summary.dto";
import type { TeacherWeeklyReportResponse } from "./dto/teacher-weekly-report.dto";

/** Snapshot fields used by weekly report deltas (DB-backed, camelCase). */
type WeeklyClassSnapshotShape = {
  performance: number | null;
  attendance: number | null;
  engagement: number | null;
  riskScore: number | null;
  riskComposite: number | null;
  riskCategory: string | null;
} | null;

type WeeklyStudentSnapshotShape = {
  performance: number | null;
  attendance: number | null;
  engagement: number | null;
  riskScore: number | null;
  riskComposite: number | null;
  riskCategory: string | null;
} | null;

type ClassEnrollmentRow = RowDataPacket & {
  classId: string;
  name: string;
  studentId: string;
  student_pk: string;
  displayName: string | null;
  givenName: string | null;
  familyName: string | null;
};

type TeacherClassWithEnrollments = {
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
};

type ClassListRow = RowDataPacket & { id: string; name: string };

type ClassSnapDbRow = RowDataPacket & {
  performance: number | null;
  attendance: number | null;
  engagement: number | null;
  riskScore: number | null;
  riskComposite: number | null;
  riskCategory: string | null;
};

function asTeacherJwt(user: JwtPayload, schoolId: string, teacherId: string): JwtPayload {
  return {
    sub: user.sub,
    email: user.email,
    schoolId,
    role: UserRole.TEACHER,
    teacherId,
  };
}

function studentDisplayName(s: {
  displayName: string | null;
  givenName: string | null;
  familyName: string | null;
  id: string;
}): string {
  return s.displayName ?? ([s.givenName, s.familyName].filter(Boolean).join(" ") || s.id);
}

/** Monday 00:00 UTC of the calendar week containing `d`. */
function mondayUtcContaining(d: Date): Date {
  const x = new Date(d);
  const day = x.getUTCDay();
  const diff = (day + 6) % 7;
  x.setUTCDate(x.getUTCDate() - diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/** True if attendance dropped by more than 20 percentage points (0–1 scale or 0–100 scale). */
function attendanceDropAttention(attendanceDelta: number): boolean {
  return attendanceDelta < -0.2 || attendanceDelta < -20;
}

function deltaCompositeRisk(a: number | null | undefined, b: number | null | undefined): number {
  if (a == null || b == null) return 0;
  return Math.round((a - b) * 10) / 10;
}

function mapClassSnapRow(row: ClassSnapDbRow | undefined): WeeklyClassSnapshotShape {
  if (!row) return null;
  return {
    performance: row.performance != null ? Number(row.performance) : null,
    attendance: row.attendance != null ? Number(row.attendance) : null,
    engagement: row.engagement != null ? Number(row.engagement) : null,
    riskScore: row.riskScore != null ? Number(row.riskScore) : null,
    riskComposite: row.riskComposite != null ? Number(row.riskComposite) : null,
    riskCategory: row.riskCategory ?? null,
  };
}

function mapStudentSnapRow(row: ClassSnapDbRow | undefined): WeeklyStudentSnapshotShape {
  return mapClassSnapRow(row) as WeeklyStudentSnapshotShape;
}

@Injectable()
export class WeeklyReportsService {
  private readonly logger = new Logger(WeeklyReportsService.name);

  constructor(
    private readonly db: MySQLService,
    private readonly analytics: AnalyticsService,
    private readonly risk: RiskService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private getSnapshotValue(row: WeeklyClassSnapshotShape | WeeklyStudentSnapshotShape, field: string): number {
    if (row == null) return 0;
    const v = (row as Record<string, unknown>)[field];
    if (v == null) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private computeStability(
    t: WeeklyStudentSnapshotShape,
    l: WeeklyStudentSnapshotShape,
  ): number {
    const perfDelta = this.getSnapshotValue(t, "performance") - this.getSnapshotValue(l, "performance");
    const attDelta = this.getSnapshotValue(t, "attendance") - this.getSnapshotValue(l, "attendance");
    const engDelta = this.getSnapshotValue(t, "engagement") - this.getSnapshotValue(l, "engagement");
    const riskDelta = this.getSnapshotValue(l, "riskScore") - this.getSnapshotValue(t, "riskScore");

    // riskDelta is inverted because lower risk is better

    return perfDelta + attDelta + engDelta + riskDelta;
  }

  private classifyTier(value: number): number {
    if (value >= 80) return 1;
    if (value >= 50) return 2;
    return 3;
  }

  /** Week-over-week delta from snapshot rows (same rounding as previous delta helpers). */
  private snapshotFieldDelta(
    thisSnap: WeeklyClassSnapshotShape | WeeklyStudentSnapshotShape,
    lastSnap: WeeklyClassSnapshotShape | WeeklyStudentSnapshotShape,
    field: "performance" | "attendance" | "engagement" | "riskScore",
  ): number {
    const hasThis = thisSnap != null;
    const hasLast = lastSnap != null;
    const tw = this.getSnapshotValue(thisSnap, field);
    const lw = this.getSnapshotValue(lastSnap, field);

    let raw: number;
    if (hasThis && hasLast) {
      raw = tw - lw;
    } else if (hasThis && !hasLast) {
      raw = tw;
    } else if (!hasThis && hasLast) {
      raw = -lw;
    } else {
      return 0;
    }

    switch (field) {
      case "performance":
        return Math.round(raw * 10) / 10;
      case "attendance":
        return Math.round(raw * 1000) / 1000;
      case "engagement":
        return Math.round(raw);
      case "riskScore":
        return Math.round(raw * 10) / 10;
      default:
        return 0;
    }
  }

  private getAiBaseUrl(): string {
    return (this.config.get<string>("AI_SERVICE_URL") ?? "http://ai:8000").replace(/\/$/, "");
  }

  private async loadClassSnapshots(
    classId: string,
    thisWeek: Date,
    lastWeek: Date,
  ): Promise<{ thisWeek: WeeklyClassSnapshotShape; lastWeek: WeeklyClassSnapshotShape }> {
    const sql = `
      SELECT \`performance\`, \`attendance\`, \`engagement\`, \`riskScore\`,
             \`riskComposite\`, \`riskCategory\`
      FROM weekly_class_snapshots
      WHERE \`classId\` = ? AND \`weekStartDate\` = ?
      LIMIT 1
    `;
    const [thisPacket, lastPacket] = await Promise.all([
      this.db.query(sql, [classId, thisWeek]),
      this.db.query(sql, [classId, lastWeek]),
    ]);
    const thisRows = thisPacket[0] as ClassSnapDbRow[];
    const lastRows = lastPacket[0] as ClassSnapDbRow[];
    return {
      thisWeek: mapClassSnapRow(thisRows[0]),
      lastWeek: mapClassSnapRow(lastRows[0]),
    };
  }

  private async loadStudentSnapshots(
    studentId: string,
    thisWeek: Date,
    lastWeek: Date,
  ): Promise<{ thisWeek: WeeklyStudentSnapshotShape; lastWeek: WeeklyStudentSnapshotShape }> {
    const sql = `
      SELECT \`performance\`, \`attendance\`, \`engagement\`, \`riskScore\`,
             \`riskComposite\`, \`riskCategory\`
      FROM weekly_student_snapshots
      WHERE \`studentId\` = ? AND \`weekStartDate\` = ?
      LIMIT 1
    `;
    const [thisPacket, lastPacket] = await Promise.all([
      this.db.query(sql, [studentId, thisWeek]),
      this.db.query(sql, [studentId, lastWeek]),
    ]);
    const thisRows = thisPacket[0] as ClassSnapDbRow[];
    const lastRows = lastPacket[0] as ClassSnapDbRow[];
    return {
      thisWeek: mapStudentSnapRow(thisRows[0]),
      lastWeek: mapStudentSnapRow(lastRows[0]),
    };
  }

  assertTeacherAccess(user: JwtPayload, teacherId: string): void {
    if (user.role === UserRole.TEACHER && user.teacherId !== teacherId) {
      throw new ForbiddenException("You can only access your own weekly report");
    }
  }

  private async tryAiReport(payload: Record<string, unknown>): Promise<string | null> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ summary?: string }>(`${this.getAiBaseUrl()}/generate-weekly-teacher-report`, payload, {
          headers: aiHttpHeaders(this.config),
          timeout: this.config.get<number>("AI_SERVICE_TIMEOUT_MS") ?? 60_000,
        }),
      );
      const s = res.data?.summary;
      return typeof s === "string" ? s : null;
    } catch (err) {
      if (err instanceof AxiosError) {
        this.logger.warn(`Weekly report AI failed: ${err.response?.status ?? err.code}`);
      } else {
        this.logger.warn(`Weekly report AI failed: ${err instanceof Error ? err.message : err}`);
      }
      return null;
    }
  }

  private async loadTeacherClassesWithEnrollments(
    schoolId: string,
    teacherId: string,
  ): Promise<TeacherClassWithEnrollments[]> {
    const classesSql = `
      SELECT id, name FROM classes
      WHERE school_id = ? AND primary_teacher_id = ? AND deleted_at IS NULL
      ORDER BY name ASC
    `;
    const classPacket = (await this.db.query(classesSql, [schoolId, teacherId]))[0] as ClassListRow[];
    const classRows = classPacket as ClassListRow[];
    if (classRows.length === 0) return [];

    const classIds = classRows.map((r) => String(r.id));
    const placeholders = classIds.map(() => "?").join(", ");
    const enSql = `
      SELECT c.id AS classId,
             c.name,
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
        AND e.class_id IN (${placeholders})
      ORDER BY c.name ASC, e.student_id
    `;
    const enPacket = (await this.db.query(enSql, [
      schoolId,
      teacherId,
      ...classIds,
    ]))[0] as ClassEnrollmentRow[];
    const enRows = enPacket as ClassEnrollmentRow[];

    const byClass = new Map<string, TeacherClassWithEnrollments>();

    for (const cr of classRows) {
      const id = String(cr.id);
      byClass.set(id, { id, name: String(cr.name), enrollments: [] });
    }
    for (const r of enRows) {
      const entry = byClass.get(r.classId);
      if (!entry) continue;
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

    return classIds.map((id) => byClass.get(id)!);
  }

  async buildWeeklyReport(schoolId: string, teacherId: string, user: JwtPayload): Promise<TeacherWeeklyReportResponse> {
    this.assertTeacherAccess(user, teacherId);

    const teacherSql = `
      SELECT id FROM teachers
      WHERE id = ? AND school_id = ? AND deleted_at IS NULL
      LIMIT 1
    `;
    const tPacket = (await this.db.query(teacherSql, [teacherId, schoolId]))[0] as RowDataPacket[];
    const tRows = tPacket as RowDataPacket[];
    if (!tRows[0]) throw new NotFoundException("Teacher not found");

    const scoped = asTeacherJwt(user, schoolId, teacherId);
    const now = new Date();
    const thisWeekMonday = mondayUtcContaining(now);
    const lastWeekMonday = new Date(thisWeekMonday);
    lastWeekMonday.setUTCDate(lastWeekMonday.getUTCDate() - 7);

    const classes = await this.loadTeacherClassesWithEnrollments(schoolId, teacherId);

    const studentIds = new Set<string>();
    for (const cls of classes) {
      for (const e of cls.enrollments) studentIds.add(e.studentId);
    }

    const classIdList = classes.map((c) => c.id);
    const studentIdList = [...studentIds];

    await Promise.all([
      ...classIdList.map((classId) =>
        Promise.all([
          this.analytics.getClassAnalytics(classId, scoped),
          this.risk.getClassRisk(schoolId, classId, scoped),
        ]),
      ),
      ...studentIdList.map((studentId) =>
        Promise.all([
          this.analytics.getStudentAnalytics(studentId, scoped),
          this.risk.getStudentRisk(schoolId, studentId, scoped),
        ]),
      ),
    ]);

    const classSummaries = await Promise.all(
      classes.map(async (cls) => {
        const { thisWeek: t, lastWeek: l } = await this.loadClassSnapshots(
          cls.id,
          thisWeekMonday,
          lastWeekMonday,
        );

        const performanceDelta = this.snapshotFieldDelta(t, l, "performance");
        const attendanceDelta = this.snapshotFieldDelta(t, l, "attendance");
        const engagementDelta = this.snapshotFieldDelta(t, l, "engagement");
        const riskDelta = this.snapshotFieldDelta(t, l, "riskScore");

        const countSql = `
          SELECT COUNT(*) AS c FROM interventions
          WHERE school_id = ? AND teacher_id = ? AND class_id = ? AND created_at >= ?
        `;
        const cntPacket = (await this.db.query(countSql, [
          schoolId,
          teacherId,
          cls.id,
          thisWeekMonday,
        ]))[0] as RowDataPacket[];
        const cntRows = cntPacket as RowDataPacket[];
        const newInterventions = Number(cntRows[0]?.c ?? 0);

        return {
          classId: cls.id,
          name: cls.name,
          performanceDelta,
          attendanceDelta,
          engagementDelta,
          riskDelta,
          newInterventions,
        };
      }),
    );

    const studentNameById = new Map<string, string>();
    for (const c of classes) {
      for (const e of c.enrollments) {
        studentNameById.set(e.studentId, studentDisplayName(e.student));
      }
    }

    const attentionRows = await Promise.all(
      studentIdList.map(async (sid) => {
        const { thisWeek: st, lastWeek: lw } = await this.loadStudentSnapshots(
          sid,
          thisWeekMonday,
          lastWeekMonday,
        );

        const performanceDelta = this.snapshotFieldDelta(st, lw, "performance");
        const attendanceDelta = this.snapshotFieldDelta(st, lw, "attendance");
        const engagementDelta = this.snapshotFieldDelta(st, lw, "engagement");
        const riskDelta = this.snapshotFieldDelta(st, lw, "riskScore");

        const stuCountSql = `
          SELECT COUNT(*) AS c FROM interventions
          WHERE school_id = ? AND teacher_id = ? AND student_id = ? AND created_at >= ?
        `;
        const stuCntPacket = (await this.db.query(stuCountSql, [
          schoolId,
          teacherId,
          sid,
          thisWeekMonday,
        ]))[0] as RowDataPacket[];
        const stuCntRows = stuCntPacket as RowDataPacket[];
        const interventionsThisWeek = Number(stuCntRows[0]?.c ?? 0);

        const performanceTier = this.classifyTier(this.getSnapshotValue(st, "performance"));
        const attendanceTier = this.classifyTier(this.getSnapshotValue(st, "attendance"));
        const engagementTier = this.classifyTier(this.getSnapshotValue(st, "engagement"));
        const riskTier = this.classifyTier(this.getSnapshotValue(st, "riskScore"));

        const performanceTierLastWeek = this.classifyTier(this.getSnapshotValue(lw, "performance"));
        const attendanceTierLastWeek = this.classifyTier(this.getSnapshotValue(lw, "attendance"));
        const engagementTierLastWeek = this.classifyTier(this.getSnapshotValue(lw, "engagement"));
        const riskTierLastWeek = this.classifyTier(this.getSnapshotValue(lw, "riskScore"));

        const riskEngineDelta = deltaCompositeRisk(st?.riskComposite, lw?.riskComposite);

        const needsAttention =
          (riskTier === 3 && riskTierLastWeek !== 3) ||
          (performanceTier === 3 && performanceTierLastWeek !== 3) ||
          (attendanceTier === 3 && attendanceTierLastWeek !== 3) ||
          (engagementTier === 3 && engagementTierLastWeek !== 3) ||
          (st?.riskCategory ?? "").toLowerCase() === "high" ||
          riskEngineDelta > 10 ||
          performanceDelta < -10 ||
          attendanceDropAttention(attendanceDelta) ||
          engagementDelta < -30 ||
          interventionsThisWeek > 0;

        if (!needsAttention) return null;

        const stability = this.computeStability(st, lw);

        return {
          studentId: sid,
          name: studentNameById.get(sid) ?? sid,
          performanceDelta,
          attendanceDelta,
          engagementDelta,
          riskDelta,
          interventionsThisWeek,
          stability,
          riskEngineDelta,
          interventions: [] as unknown[],
        } satisfies StudentAttentionSummary;
      }),
    );

    const attentionStudents = attentionRows.filter((r): r is StudentAttentionSummary => r !== null);

    const aiSummary = await this.tryAiReport({
      schoolId,
      teacherId,
      classes: classSummaries,
      attentionStudents,
    });

    return {
      teacherId,
      classes: classSummaries,
      attentionStudents,
      aiSummary,
    };
  }

  async getWeeklyReport(schoolId: string, teacherId: string, user: JwtPayload): Promise<TeacherWeeklyReportResponse> {
    return this.buildWeeklyReport(schoolId, teacherId, user);
  }

  async generateWeeklyReport(schoolId: string, teacherId: string, user: JwtPayload): Promise<TeacherWeeklyReportResponse> {
    return this.buildWeeklyReport(schoolId, teacherId, user);
  }
}
