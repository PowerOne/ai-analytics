import { HttpService } from "@nestjs/axios";
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserRole } from "@prisma/client";
import { AxiosError } from "axios";
import { firstValueFrom } from "rxjs";
import { AnalyticsService } from "../analytics/analytics.service";
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

function deltaPerformance(
  a: number | null | undefined,
  b: number | null | undefined,
): number {
  if (a == null || b == null) return 0;
  return Math.round((a - b) * 10) / 10;
}

function deltaAttendance(
  a: number | null | undefined,
  b: number | null | undefined,
): number {
  if (a == null || b == null) return 0;
  return Math.round((a - b) * 1000) / 1000;
}

function deltaEngagement(
  a: number | null | undefined,
  b: number | null | undefined,
): number {
  if (a == null || b == null) return 0;
  return Math.round(a - b);
}

function deltaRisk(
  a: number | null | undefined,
  b: number | null | undefined,
): number {
  if (a == null || b == null) return 0;
  return Math.round((a - b) * 10) / 10;
}

function isHighSnapshotTier(t: string | null | undefined): boolean {
  return (t ?? "").toUpperCase() === "HIGH";
}

/** True if attendance dropped by more than 20 percentage points (0–1 scale or 0–100 scale). */
function attendanceDropAttention(attendanceDelta: number): boolean {
  return attendanceDelta < -0.2 || attendanceDelta < -20;
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

  private getAiBaseUrl(): string {
    return (this.config.get<string>("AI_SERVICE_URL") ?? "http://ai:8000").replace(/\/$/, "");
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
          headers: { "Content-Type": "application/json" },
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

    const [classThisWeek, classLastWeek, studThisWeek, studLastWeek] = await Promise.all([
      classIdList.length
        ? this.prisma.weeklyClassSnapshot.findMany({
            where: {
              schoolId,
              classId: { in: classIdList },
              weekStartDate: thisWeekMonday,
            },
          })
        : [],
      classIdList.length
        ? this.prisma.weeklyClassSnapshot.findMany({
            where: {
              schoolId,
              classId: { in: classIdList },
              weekStartDate: lastWeekMonday,
            },
          })
        : [],
      studentIdList.length
        ? this.prisma.weeklyStudentSnapshot.findMany({
            where: {
              schoolId,
              studentId: { in: studentIdList },
              weekStartDate: thisWeekMonday,
            },
          })
        : [],
      studentIdList.length
        ? this.prisma.weeklyStudentSnapshot.findMany({
            where: {
              schoolId,
              studentId: { in: studentIdList },
              weekStartDate: lastWeekMonday,
            },
          })
        : [],
    ]);

    const classThisMap = new Map(classThisWeek.map((r) => [r.classId, r]));
    const classLastMap = new Map(classLastWeek.map((r) => [r.classId, r]));
    const studThisMap = new Map(studThisWeek.map((r) => [r.studentId, r]));
    const studLastMap = new Map(studLastWeek.map((r) => [r.studentId, r]));

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
        const t = classThisMap.get(cls.id);
        const l = classLastMap.get(cls.id);

        const performanceDelta = deltaPerformance(t?.performance, l?.performance);
        const attendanceDelta = deltaAttendance(t?.attendance, l?.attendance);
        const engagementDelta = deltaEngagement(t?.engagement, l?.engagement);
        const riskDelta = deltaRisk(t?.riskScore, l?.riskScore);

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
        const st = studThisMap.get(sid);
        const lw = studLastMap.get(sid);

        const performanceDelta = deltaPerformance(st?.performance, lw?.performance);
        const attendanceDelta = deltaAttendance(st?.attendance, lw?.attendance);
        const engagementDelta = deltaEngagement(st?.engagement, lw?.engagement);
        const riskDelta = deltaRisk(st?.riskScore, lw?.riskScore);

        const interventionsThisWeek = await this.prisma.intervention.count({
          where: {
            schoolId,
            teacherId,
            studentId: sid,
            createdAt: { gte: thisWeekMonday },
          },
        });

        const riskTierThisWeek = st?.riskTier ?? null;
        const riskTierLastWeek = lw?.riskTier ?? null;

        const needsAttention =
          (isHighSnapshotTier(riskTierThisWeek) && !isHighSnapshotTier(riskTierLastWeek)) ||
          performanceDelta < -10 ||
          attendanceDropAttention(attendanceDelta) ||
          engagementDelta < -30 ||
          interventionsThisWeek > 0;

        if (!needsAttention) return null;

        return {
          studentId: sid,
          name: studentNameById.get(sid) ?? sid,
          performanceDelta,
          attendanceDelta,
          engagementDelta,
          riskDelta,
          interventionsThisWeek,
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
