import { HttpService } from "@nestjs/axios";
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserRole, type WeeklyClassSnapshot, type WeeklyStudentSnapshot } from "@prisma/client";
import { AxiosError } from "axios";
import { firstValueFrom } from "rxjs";
import { AnalyticsService } from "../analytics/analytics.service";
import { aiHttpHeaders } from "../integrations/ai-request-headers";
import type { JwtPayload } from "../common/types/jwt-payload";
import { PrismaService } from "../prisma/prisma.service";
import { RiskService } from "../risk/risk.service";
import type { StudentAttentionSummary } from "./dto/student-attention-summary.dto";
import type { TeacherWeeklyReportResponse } from "./dto/teacher-weekly-report.dto";

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

@Injectable()
export class WeeklyReportsService {
  private readonly logger = new Logger(WeeklyReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly risk: RiskService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private getSnapshotValue(row: any, field: string): number {
    return row?.[field] ?? 0;
  }

  private computeStability(t: any, l: any): number {
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
    thisSnap: WeeklyClassSnapshot | WeeklyStudentSnapshot | null,
    lastSnap: WeeklyClassSnapshot | WeeklyStudentSnapshot | null,
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
  ): Promise<{ thisWeek: WeeklyClassSnapshot | null; lastWeek: WeeklyClassSnapshot | null }> {
    const [thisWeekSnap, lastWeekSnap] = await Promise.all([
      this.prisma.weeklyClassSnapshot.findFirst({
        where: { classId, weekStartDate: thisWeek },
      }),
      this.prisma.weeklyClassSnapshot.findFirst({
        where: { classId, weekStartDate: lastWeek },
      }),
    ]);
    return { thisWeek: thisWeekSnap, lastWeek: lastWeekSnap };
  }

  private async loadStudentSnapshots(
    studentId: string,
    thisWeek: Date,
    lastWeek: Date,
  ): Promise<{ thisWeek: WeeklyStudentSnapshot | null; lastWeek: WeeklyStudentSnapshot | null }> {
    const [thisWeekSnap, lastWeekSnap] = await Promise.all([
      this.prisma.weeklyStudentSnapshot.findFirst({
        where: { studentId, weekStartDate: thisWeek },
      }),
      this.prisma.weeklyStudentSnapshot.findFirst({
        where: { studentId, weekStartDate: lastWeek },
      }),
    ]);
    return { thisWeek: thisWeekSnap, lastWeek: lastWeekSnap };
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

  async buildWeeklyReport(schoolId: string, teacherId: string, user: JwtPayload): Promise<TeacherWeeklyReportResponse> {
    this.assertTeacherAccess(user, teacherId);

    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, schoolId, deletedAt: null },
    });
    if (!teacher) throw new NotFoundException("Teacher not found");

    const scoped = asTeacherJwt(user, schoolId, teacherId);
    const now = new Date();
    const thisWeekMonday = mondayUtcContaining(now);
    const lastWeekMonday = new Date(thisWeekMonday);
    lastWeekMonday.setUTCDate(lastWeekMonday.getUTCDate() - 7);

    const classes = await this.prisma.class.findMany({
      where: { schoolId, primaryTeacherId: teacherId, deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        enrollments: {
          where: { status: "active", deletedAt: null },
          include: { student: { select: { id: true, displayName: true, givenName: true, familyName: true } } },
        },
      },
    });

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

        const newInterventions = await this.prisma.intervention.count({
          where: {
            schoolId,
            teacherId,
            classId: cls.id,
            createdAt: { gte: thisWeekMonday },
          },
        });

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

        const interventionsThisWeek = await this.prisma.intervention.count({
          where: {
            schoolId,
            teacherId,
            studentId: sid,
            createdAt: { gte: thisWeekMonday },
          },
        });

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
