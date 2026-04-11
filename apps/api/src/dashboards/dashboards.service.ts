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
import type { TrendPoint } from "../analytics/dto/common.dto";
import type { JwtPayload } from "../common/types/jwt-payload";
import { LmsHeatmapsService } from "../lms-heatmaps/lms-heatmaps.service";
import { PrismaService } from "../prisma/prisma.service";
import { RiskService } from "../risk/risk.service";
import { RiskLevel } from "../risk/dto/risk-level.enum";
import { RiskInput, type RiskOutput } from "../risk/risk-engine.types";
import type { SchoolTrendSummary } from "../principal-reports/dto/school-trend.dto";
import type { CohortDashboardResponse } from "./dto/cohort-dashboard.dto";
import type { PrincipalDashboardResponse } from "./dto/principal-dashboard.dto";
import type { Student360DashboardResponse } from "./dto/student360-dashboard.dto";
import type { TeacherDashboardResponse } from "./dto/teacher-dashboard.dto";
import type { StudentAttentionSummary } from "../weekly-reports/dto/student-attention-summary.dto";
import { aiHttpHeaders } from "../integrations/ai-request-headers";
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
  private readonly logger = new Logger(DashboardsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly risk: RiskService,
    private readonly lmsHeatmaps: LmsHeatmapsService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private getAiBaseUrl(): string {
    return (this.config.get<string>("AI_SERVICE_URL") ?? "http://ai:8000").replace(/\/$/, "");
  }

  private async tryAi(path: string, payload: Record<string, unknown>): Promise<string | null> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ summary?: string }>(`${this.getAiBaseUrl()}${path}`, payload, {
          headers: aiHttpHeaders(this.config),
          timeout: this.config.get<number>("AI_SERVICE_TIMEOUT_MS") ?? 60_000,
        }),
      );
      const s = res.data?.summary;
      return typeof s === "string" ? s : null;
    } catch (err) {
      if (err instanceof AxiosError) {
        this.logger.warn(`Dashboard AI ${path} failed: ${err.response?.status ?? err.code}`);
      } else {
        this.logger.warn(`Dashboard AI ${path} failed: ${err instanceof Error ? err.message : err}`);
      }
      return null;
    }
  }

  /** POST to AI service and parse a JSON array (interventions or schoolInterventions); does not modify tryAi(). */
  private async postAiJsonArray(path: string, payload: Record<string, unknown>): Promise<unknown[]> {
    try {
      const res = await firstValueFrom(
        this.http.post<Record<string, unknown>>(`${this.getAiBaseUrl()}${path}`, payload, {
          headers: aiHttpHeaders(this.config),
          timeout: this.config.get<number>("AI_SERVICE_TIMEOUT_MS") ?? 60_000,
        }),
      );
      const d = res.data;
      if (Array.isArray(d)) return d;
      if (d && typeof d === "object") {
        if (Array.isArray(d.interventions)) return d.interventions as unknown[];
        if (Array.isArray(d.schoolInterventions)) return d.schoolInterventions as unknown[];
      }
      return [];
    } catch (err) {
      if (err instanceof AxiosError) {
        this.logger.warn(`Dashboard AI ${path} failed: ${err.response?.status ?? err.code}`);
      } else {
        this.logger.warn(`Dashboard AI ${path} failed: ${err instanceof Error ? err.message : err}`);
      }
      return [];
    }
  }

  /**
   * Build intervention context and request AI-generated interventions (separate from tryAi summary).
   */
  async getInterventions(studentId: string): Promise<unknown[]> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null },
    });
    if (!student) return [];

    const schoolId = student.schoolId;
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

    const enrollment = await this.prisma.enrollment.findFirst({
      where: { schoolId, studentId, status: "active", deletedAt: null },
      orderBy: { id: "asc" },
    });
    const classId = enrollment?.classId ?? student.classId ?? "";

    const [stThis, stLast, classThis, classLast, schoolThis, schoolLast] = await Promise.all([
      this.prisma.weeklyStudentSnapshot.findFirst({
        where: { schoolId, studentId, weekStartDate: thisWeekMonday },
      }),
      this.prisma.weeklyStudentSnapshot.findFirst({
        where: { schoolId, studentId, weekStartDate: lastWeekMonday },
      }),
      classId
        ? this.prisma.weeklyClassSnapshot.findFirst({
            where: { schoolId, classId, weekStartDate: thisWeekMonday },
          })
        : null,
      classId
        ? this.prisma.weeklyClassSnapshot.findFirst({
            where: { schoolId, classId, weekStartDate: lastWeekMonday },
          })
        : null,
      this.prisma.weeklySchoolSnapshot.findFirst({
        where: { schoolId, weekStartDate: thisWeekMonday },
      }),
      this.prisma.weeklySchoolSnapshot.findFirst({
        where: { schoolId, weekStartDate: lastWeekMonday },
      }),
    ]);

    const classA = classId ? await this.analytics.getClassAnalytics(classId, scoped) : null;

    const riskInput: RiskInput = {
      studentId,
      classId: student.classId ?? classId ?? "",
      performance: student.performance ?? 0,
      attendance: student.attendance ?? 0,
      engagement: student.engagement ?? 0,
      riskScore: student.riskScore ?? 0,
      deltas: (student.deltas as RiskInput["deltas"]) ?? { performance: 0, attendance: 0, engagement: 0, risk: 0 },
      tiers: (student.tiers as RiskInput["tiers"]) ?? { performance: 1, attendance: 1, engagement: 1, risk: 1 },
      flags:
        (student.flags as RiskInput["flags"]) ?? {
          lowPerformance: false,
          lowAttendance: false,
          lowEngagement: false,
          highRisk: false,
        },
      stability: student.stability ?? 0,
    };

    const engineRisk: RiskOutput = this.risk.getStudentRiskEngine(riskInput);

    const riskEngineHistory = {
      composite: stThis?.riskComposite ?? null,
      category: stThis?.riskCategory ?? null,
      reasons: Array.isArray(stThis?.riskReasons) ? (stThis.riskReasons as string[]) : [],
      stability: stThis?.riskStability ?? null,
      deltas: (stThis?.riskDeltas as Record<string, unknown> | null) ?? null,
    };

    const deltas = {
      performanceDelta: deltaPerformance(stThis?.performance, stLast?.performance),
      attendanceDelta: deltaAttendance(stThis?.attendance, stLast?.attendance),
      engagementDelta: deltaEngagement(stThis?.engagement, stLast?.engagement),
      riskDelta: deltaRisk(stThis?.riskScore, stLast?.riskScore),
      riskCompositeDelta: deltaCompositeRisk(stThis?.riskComposite, stLast?.riskComposite),
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
      riskComposite: classThis?.riskComposite ?? null,
      riskCompositeDelta: deltaCompositeRisk(classThis?.riskComposite, classLast?.riskComposite),
      deltas: {
        performance: deltaPerformance(classThis?.performance, classLast?.performance),
        attendance: deltaAttendance(classThis?.attendance, classLast?.attendance),
        engagement: deltaEngagement(classThis?.engagement, classLast?.engagement),
        risk: deltaRisk(classThis?.riskScore, classLast?.riskScore),
      },
      thisWeek: classThis ? snapshotStrip(classThis) : null,
      lastWeek: classLast ? snapshotStrip(classLast) : null,
    };

    const schoolContext = {
      averages: {
        performance: schoolThis?.performance ?? null,
        attendance: schoolThis?.attendance ?? null,
        engagement: schoolThis?.engagement ?? null,
      },
      riskComposite: schoolThis?.riskComposite ?? null,
      riskCompositeDelta: deltaCompositeRisk(schoolThis?.riskComposite, schoolLast?.riskComposite),
      deltas: {
        performance: deltaPerformance(schoolThis?.performance, schoolLast?.performance),
        attendance: deltaAttendance(schoolThis?.attendance, schoolLast?.attendance),
        engagement: deltaEngagement(schoolThis?.engagement, schoolLast?.engagement),
        risk: deltaRisk(schoolThis?.riskAverage, schoolLast?.riskAverage),
      },
    };

    const previousInterventions = await this.prisma.intervention.findMany({
      where: { schoolId, studentId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

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

    return this.postAiJsonArray("/generate-interventions", payload);
  }

  assertTeacherSelf(user: JwtPayload, teacherId: string): void {
    if (user.role === UserRole.TEACHER && user.teacherId !== teacherId) {
      throw new ForbiddenException("You can only access your own teacher dashboard");
    }
  }

  async assertStudentVisible(user: JwtPayload, schoolId: string, studentId: string): Promise<void> {
    if (user.role === UserRole.TEACHER && user.teacherId) {
      const ok = await this.prisma.enrollment.findFirst({
        where: {
          schoolId,
          studentId,
          deletedAt: null,
          status: "active",
          class: { primaryTeacherId: user.teacherId, deletedAt: null },
        },
      });
      if (!ok) throw new ForbiddenException("Student is not in your classes");
    }
  }

  async getTeacherDashboard(
    schoolId: string,
    teacherId: string,
    user: JwtPayload,
  ): Promise<TeacherDashboardResponse> {
    this.assertTeacherSelf(user, teacherId);

    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, schoolId, deletedAt: null },
    });
    if (!teacher) throw new NotFoundException("Teacher not found");

    const scoped = asTeacherJwt(user, schoolId, teacherId);
    const now = new Date();
    const thisWeekMonday = mondayUtcContaining(now);
    const lastWeekMonday = new Date(thisWeekMonday);
    lastWeekMonday.setUTCDate(lastWeekMonday.getUTCDate() - 7);

    const heatmapFrom = new Date(now);
    heatmapFrom.setUTCDate(heatmapFrom.getUTCDate() - 14);
    const fromStr = formatYmd(heatmapFrom);
    const toStr = formatYmd(now);

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

    const classIds = classes.map((c) => c.id);
    const studentIds = new Set<string>();
    for (const c of classes) for (const e of c.enrollments) studentIds.add(e.studentId);
    const studentIdList = [...studentIds];

    const [classThis, classLast, studThis, studLast, schoolThisSnap, hm, interventionsThisWeek] =
      await Promise.all([
        classIds.length
          ? this.prisma.weeklyClassSnapshot.findMany({
              where: { schoolId, classId: { in: classIds }, weekStartDate: thisWeekMonday },
            })
          : [],
        classIds.length
          ? this.prisma.weeklyClassSnapshot.findMany({
              where: { schoolId, classId: { in: classIds }, weekStartDate: lastWeekMonday },
            })
          : [],
        studentIdList.length
          ? this.prisma.weeklyStudentSnapshot.findMany({
              where: { schoolId, studentId: { in: studentIdList }, weekStartDate: thisWeekMonday },
            })
          : [],
        studentIdList.length
          ? this.prisma.weeklyStudentSnapshot.findMany({
              where: { schoolId, studentId: { in: studentIdList }, weekStartDate: lastWeekMonday },
            })
          : [],
        this.prisma.weeklySchoolSnapshot.findFirst({
          where: { schoolId, weekStartDate: thisWeekMonday },
        }),
        this.lmsHeatmaps.getSchoolHeatmap(schoolId, scoped, fromStr, toStr),
        this.prisma.intervention.count({
          where: { schoolId, teacherId, createdAt: { gte: thisWeekMonday } },
        }),
      ]);

    const classThisMap = new Map(classThis.map((r) => [r.classId, r]));
    const classLastMap = new Map(classLast.map((r) => [r.classId, r]));
    const studThisMap = new Map(studThis.map((r) => [r.studentId, r]));
    const studLastMap = new Map(studLast.map((r) => [r.studentId, r]));

    const classSummaries = classes.map((cls) => {
      const t = classThisMap.get(cls.id);
      const l = classLastMap.get(cls.id);
      return {
        classId: cls.id,
        name: cls.name,
        thisWeek: t ? snapshotStrip(t) : null,
        lastWeek: l ? snapshotStrip(l) : null,
        performanceDelta: deltaPerformance(t?.performance, l?.performance),
        attendanceDelta: deltaAttendance(t?.attendance, l?.attendance),
        engagementDelta: deltaEngagement(t?.engagement, l?.engagement),
        riskDelta: deltaRisk(t?.riskScore, l?.riskScore),
        riskCompositeDelta: deltaCompositeRisk(t?.riskComposite, l?.riskComposite),
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
        const performanceDelta = deltaPerformance(st?.performance, lw?.performance);
        const attendanceDelta = deltaAttendance(st?.attendance, lw?.attendance);
        const engagementDelta = deltaEngagement(st?.engagement, lw?.engagement);
        const riskDelta = deltaRisk(st?.riskScore, lw?.riskScore);
        const interventionsThisWeekStudent = await this.prisma.intervention.count({
          where: { schoolId, teacherId, studentId: sid, createdAt: { gte: thisWeekMonday } },
        });
        const riskTierThisWeek = st?.riskTier ?? null;
        const riskTierLastWeek = lw?.riskTier ?? null;
        const riskEngineDelta = deltaCompositeRisk(st?.riskComposite, lw?.riskComposite);
        const needsAttention =
          (isHighSnapshotTier(riskTierThisWeek) && !isHighSnapshotTier(riskTierLastWeek)) ||
          (st?.riskCategory ?? "").toLowerCase() === "high" ||
          riskEngineDelta > 10 ||
          performanceDelta < -10 ||
          attendanceDropAttention(attendanceDelta) ||
          engagementDelta < -30 ||
          interventionsThisWeekStudent > 0;
        if (!needsAttention) return null;
        const stability = computeSnapshotStability(st, lw);
        const multiNegative =
          [performanceDelta, attendanceDelta, engagementDelta, riskDelta].filter((d) => d < 0).length >= 2;
        const shouldFetchInterventions =
          (st?.riskCategory ?? "").toLowerCase() === "high" ||
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

    const aiSummary = await this.tryAi("/generate-teacher-dashboard-summary", {
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
        composite: schoolThisSnap?.riskComposite ?? null,
        category: schoolThisSnap?.riskCategory ?? null,
        reasons: Array.isArray(schoolThisSnap?.riskReasons)
          ? (schoolThisSnap.riskReasons as string[])
          : [],
        stability: schoolThisSnap?.riskStability ?? null,
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

  async getPrincipalDashboard(schoolId: string, user: JwtPayload): Promise<PrincipalDashboardResponse> {
    const scoped = toPrincipalScope(user, schoolId);
    const now = new Date();
    const thisWeekMonday = mondayUtcContaining(now);
    const lastWeekMonday = new Date(thisWeekMonday);
    lastWeekMonday.setUTCDate(lastWeekMonday.getUTCDate() - 7);
    const weekEndExclusive = new Date(thisWeekMonday);
    weekEndExclusive.setUTCDate(weekEndExclusive.getUTCDate() + 7);

    const heatmapFrom = new Date(now);
    heatmapFrom.setUTCDate(heatmapFrom.getUTCDate() - 14);
    const fromStr = formatYmd(heatmapFrom);
    const toStr = formatYmd(now);

    const [schoolThis, schoolLast, cohortThis, cohortLast, hm, created, resolved] = await Promise.all([
      this.prisma.weeklySchoolSnapshot.findFirst({
        where: { schoolId, weekStartDate: thisWeekMonday },
      }),
      this.prisma.weeklySchoolSnapshot.findFirst({
        where: { schoolId, weekStartDate: lastWeekMonday },
      }),
      this.prisma.weeklyCohortSnapshot.findMany({
        where: { schoolId, weekStartDate: thisWeekMonday },
      }),
      this.prisma.weeklyCohortSnapshot.findMany({
        where: { schoolId, weekStartDate: lastWeekMonday },
      }),
      this.lmsHeatmaps.getSchoolHeatmap(schoolId, scoped, fromStr, toStr),
      this.prisma.intervention.count({
        where: { schoolId, createdAt: { gte: thisWeekMonday, lt: weekEndExclusive } },
      }),
      this.prisma.intervention.count({
        where: {
          schoolId,
          status: "resolved",
          updatedAt: { gte: thisWeekMonday, lt: weekEndExclusive },
        },
      }),
    ]);

    const lastCohortMap = new Map(cohortLast.map((r) => [`${r.cohortType}:${r.cohortId}`, r]));

    const schoolTrends: SchoolTrendSummary = {
      performanceDelta: deltaPerformance(schoolThis?.performance, schoolLast?.performance),
      attendanceDelta: deltaAttendance(schoolThis?.attendance, schoolLast?.attendance),
      engagementDelta: deltaEngagement(schoolThis?.engagement, schoolLast?.engagement),
      riskDelta: deltaRisk(schoolThis?.riskAverage, schoolLast?.riskAverage),
      highRiskNew: schoolThis?.riskHigh ?? 0,
      riskCompositeDelta: deltaCompositeRisk(schoolThis?.riskComposite, schoolLast?.riskComposite),
    };

    const cohorts = cohortThis.map((t) => {
      const l = lastCohortMap.get(`${t.cohortType}:${t.cohortId}`);
      return {
        cohortType: t.cohortType as "GRADE" | "SUBJECT",
        cohortId: t.cohortId,
        name: t.name,
        performanceDelta: deltaPerformance(t.performance, l?.performance),
        attendanceDelta: deltaAttendance(t.attendance, l?.attendance),
        engagementDelta: deltaEngagement(t.engagement, l?.engagement),
        riskDelta: deltaRisk(t.riskAverage, l?.riskAverage),
        risk: {
          low: t.riskLow ?? 0,
          medium: t.riskMedium ?? 0,
          high: t.riskHigh ?? 0,
          average: t.riskAverage ?? 0,
        },
        interventions: t.interventions ?? 0,
      };
    });

    const resolutionRate =
      created > 0 ? Math.min(1, Math.round((resolved / created) * 1000) / 1000) : 0;

    const schoolContext = {
      thisWeek: schoolThis,
      lastWeek: schoolLast,
      averages: {
        performance: schoolThis?.performance ?? null,
        attendance: schoolThis?.attendance ?? null,
        engagement: schoolThis?.engagement ?? null,
      },
      riskComposite: schoolThis?.riskComposite ?? null,
      riskCompositeDelta: deltaCompositeRisk(schoolThis?.riskComposite, schoolLast?.riskComposite),
    };

    const schoolRiskHistory = {
      composite: schoolThis?.riskComposite ?? null,
      category: schoolThis?.riskCategory ?? null,
      reasons: Array.isArray(schoolThis?.riskReasons) ? (schoolThis.riskReasons as string[]) : [],
      stability: schoolThis?.riskStability ?? null,
      deltas: (schoolThis?.riskDeltas as Record<string, unknown> | null) ?? null,
    };

    const schoolInterventions = await this.postAiJsonArray("/generate-school-interventions", {
      school: schoolContext,
      trends: schoolTrends,
      riskEngineHistory: schoolRiskHistory,
    });

    const aiSummary = await this.tryAi("/generate-principal-dashboard-summary", {
      schoolId,
      schoolTrends,
      cohorts,
      interventions: { created, resolved, resolutionRate },
      schoolInterventions,
      riskEngine: null,
      riskEngineHistory: schoolRiskHistory,
    });

    return {
      schoolId,
      schoolTrends,
      cohorts,
      interventions: { created, resolved, resolutionRate },
      heatmap: { daily: hm.heatmap, weekly: hm.weekly },
      aiSummary,
      schoolInterventions,
    };
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
      this.prisma.weeklyCohortSnapshot.findFirst({
        where: {
          schoolId,
          cohortType: "GRADE",
          cohortId: key,
          weekStartDate: thisWeekMonday,
        },
      }),
      this.prisma.weeklyCohortSnapshot.findFirst({
        where: {
          schoolId,
          cohortType: "GRADE",
          cohortId: key,
          weekStartDate: lastWeekMonday,
        },
      }),
      this.lmsHeatmaps.getGradeHeatmap(schoolId, key, scoped, fromStr, toStr),
    ]);

    if (!t) {
      throw new NotFoundException("No weekly cohort snapshot for this grade yet");
    }

    const performanceDelta = deltaPerformance(t.performance, l?.performance);
    const attendanceDelta = deltaAttendance(t.attendance, l?.attendance);
    const engagementDelta = deltaEngagement(t.engagement, l?.engagement);
    const riskDelta = deltaRisk(t.riskAverage, l?.riskAverage);

    const aiSummary = await this.tryAi("/generate-cohort-dashboard-summary", {
      schoolId,
      cohortType: "GRADE",
      cohortId: key,
      name: t.name,
      performanceDelta,
      attendanceDelta,
      engagementDelta,
      riskDelta,
      risk: {
        low: t.riskLow ?? 0,
        medium: t.riskMedium ?? 0,
        high: t.riskHigh ?? 0,
        average: t.riskAverage ?? 0,
      },
      interventions: t.interventions ?? 0,
      riskEngine: null,
      riskEngineHistory: null,
    });

    return {
      cohortType: "GRADE",
      cohortId: key,
      name: t.name,
      performanceDelta,
      attendanceDelta,
      engagementDelta,
      riskDelta,
      risk: {
        low: t.riskLow ?? 0,
        medium: t.riskMedium ?? 0,
        high: t.riskHigh ?? 0,
        average: t.riskAverage ?? 0,
      },
      interventions: t.interventions ?? 0,
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
      this.prisma.weeklyCohortSnapshot.findFirst({
        where: {
          schoolId,
          cohortType: "SUBJECT",
          cohortId: subjectId,
          weekStartDate: thisWeekMonday,
        },
      }),
      this.prisma.weeklyCohortSnapshot.findFirst({
        where: {
          schoolId,
          cohortType: "SUBJECT",
          cohortId: subjectId,
          weekStartDate: lastWeekMonday,
        },
      }),
      this.lmsHeatmaps.getSubjectHeatmap(schoolId, subjectId, scoped, fromStr, toStr),
    ]);

    if (!t) {
      throw new NotFoundException("No weekly cohort snapshot for this subject yet");
    }

    const performanceDelta = deltaPerformance(t.performance, l?.performance);
    const attendanceDelta = deltaAttendance(t.attendance, l?.attendance);
    const engagementDelta = deltaEngagement(t.engagement, l?.engagement);
    const riskDelta = deltaRisk(t.riskAverage, l?.riskAverage);

    const aiSummary = await this.tryAi("/generate-cohort-dashboard-summary", {
      schoolId,
      cohortType: "SUBJECT",
      cohortId: subjectId,
      name: t.name,
      performanceDelta,
      attendanceDelta,
      engagementDelta,
      riskDelta,
      risk: {
        low: t.riskLow ?? 0,
        medium: t.riskMedium ?? 0,
        high: t.riskHigh ?? 0,
        average: t.riskAverage ?? 0,
      },
      interventions: t.interventions ?? 0,
      riskEngine: null,
      riskEngineHistory: null,
    });

    return {
      cohortType: "SUBJECT",
      cohortId: subjectId,
      name: t.name,
      performanceDelta,
      attendanceDelta,
      engagementDelta,
      riskDelta,
      risk: {
        low: t.riskLow ?? 0,
        medium: t.riskMedium ?? 0,
        high: t.riskHigh ?? 0,
        average: t.riskAverage ?? 0,
      },
      interventions: t.interventions ?? 0,
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

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId, deletedAt: null },
    });
    if (!student) throw new NotFoundException("Student not found");

    // Build RiskInput for the Risk Engine
    const riskInput: RiskInput = {
      studentId,
      classId: student.classId ?? "",
      performance: student.performance ?? 0,
      attendance: student.attendance ?? 0,
      engagement: student.engagement ?? 0,
      riskScore: student.riskScore ?? 0,
      deltas: (student.deltas as RiskInput["deltas"]) ?? { performance: 0, attendance: 0, engagement: 0, risk: 0 },
      tiers: (student.tiers as RiskInput["tiers"]) ?? { performance: 1, attendance: 1, engagement: 1, risk: 1 },
      flags:
        (student.flags as RiskInput["flags"]) ?? {
          lowPerformance: false,
          lowAttendance: false,
          lowEngagement: false,
          highRisk: false,
        },
      stability: student.stability ?? 0,
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

    const [stThis, stLast, a, r, hm, interventionCount] = await Promise.all([
      this.prisma.weeklyStudentSnapshot.findFirst({
        where: { schoolId, studentId, weekStartDate: thisWeekMonday },
      }),
      this.prisma.weeklyStudentSnapshot.findFirst({
        where: { schoolId, studentId, weekStartDate: lastWeekMonday },
      }),
      this.analytics.getStudentAnalytics(studentId, scoped),
      this.risk.getStudentRisk(schoolId, studentId, scoped),
      this.lmsHeatmaps.getStudentHeatmap(schoolId, studentId, scoped, fromStr, toStr),
      this.prisma.intervention.count({ where: { schoolId, studentId } }),
    ]);

    const performanceDelta = deltaPerformance(stThis?.performance, stLast?.performance);
    const attendanceDelta = deltaAttendance(stThis?.attendance, stLast?.attendance);
    const engagementDelta = deltaEngagement(stThis?.engagement, stLast?.engagement);
    const riskDelta = deltaRisk(stThis?.riskScore, stLast?.riskScore);
    const riskCompositeDelta = deltaCompositeRisk(stThis?.riskComposite, stLast?.riskComposite);

    const riskEngineHistory = {
      composite: stThis?.riskComposite ?? null,
      category: stThis?.riskCategory ?? null,
      reasons: Array.isArray(stThis?.riskReasons) ? (stThis.riskReasons as string[]) : [],
      stability: stThis?.riskStability ?? null,
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

    const aiSummary = await this.tryAi("/generate-student360-summary", {
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

  /** NEW: Class-level risk using the Risk Engine */
  async getClassRiskEngine(classId: string) {
    const students = await this.prisma.student.findMany({
      where: {
        enrollments: { some: { classId, status: "active", deletedAt: null } },
      },
      select: {
        id: true,
        performance: true,
        attendance: true,
        engagement: true,
        riskScore: true,
        deltas: true,
        tiers: true,
        flags: true,
        stability: true,
      },
    });

    const inputs: RiskInput[] = students.map((s) => ({
      studentId: s.id,
      classId,
      performance: s.performance ?? 0,
      attendance: s.attendance ?? 0,
      engagement: s.engagement ?? 0,
      riskScore: s.riskScore ?? 0,
      deltas: (s.deltas as RiskInput["deltas"]) ?? { performance: 0, attendance: 0, engagement: 0, risk: 0 },
      tiers: (s.tiers as RiskInput["tiers"]) ?? { performance: 1, attendance: 1, engagement: 1, risk: 1 },
      flags:
        (s.flags as RiskInput["flags"]) ?? {
          lowPerformance: false,
          lowAttendance: false,
          lowEngagement: false,
          highRisk: false,
        },
      stability: s.stability ?? 0,
    }));

    return this.risk.getClassRiskEngine(inputs);
  }
}
