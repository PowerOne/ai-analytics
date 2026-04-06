import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserRole } from "@prisma/client";
import { AxiosError } from "axios";
import { firstValueFrom } from "rxjs";
import { AnalyticsService } from "../analytics/analytics.service";
import type { TrendPoint } from "../analytics/dto/common.dto";
import type { CohortSummaryResponse } from "../cohort-analytics/dto/cohort-summary.dto";
import { CohortAnalyticsService } from "../cohort-analytics/cohort-analytics.service";
import type { JwtPayload } from "../common/types/jwt-payload";
import { LmsHeatmapsService } from "../lms-heatmaps/lms-heatmaps.service";
import { PrismaService } from "../prisma/prisma.service";
import { RiskService } from "../risk/risk.service";
import { RiskLevel } from "../risk/dto/risk-level.enum";
import type { CohortSummary } from "./dto/cohort-summary.dto";
import type { PrincipalReportResponse } from "./dto/principal-report.dto";
import type { SchoolTrendSummary } from "./dto/school-trend.dto";

function toPrincipalScope(user: JwtPayload, schoolId: string): JwtPayload {
  return {
    sub: user.sub,
    email: user.email,
    schoolId,
    role: UserRole.PRINCIPAL,
    teacherId: null,
  };
}

function subDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() - n);
  return x;
}

function formatYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDay(s: string): Date {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function meanInRange(points: TrendPoint[], start: Date, endExclusive: Date): number | null {
  const vals: number[] = [];
  const t0 = start.getTime();
  const t1 = endExclusive.getTime();
  for (const p of points) {
    const t = parseDay(p.date).getTime();
    if (t >= t0 && t < t1 && Number.isFinite(p.value)) vals.push(p.value);
  }
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function trendPctPooled(points: TrendPoint[], now: Date, windowDays: number): number {
  if (!points.length) return 0;
  const lastStart = subDays(now, windowDays);
  const prevStart = subDays(now, windowDays * 2);
  const lastMean = meanInRange(points, lastStart, now);
  const prevMean = meanInRange(points, prevStart, lastStart);
  if (prevMean == null || Math.abs(prevMean) < 1e-9 || lastMean == null) return 0;
  return Math.round(((lastMean - prevMean) / prevMean) * 1000) / 10;
}

function mergeTrendPoints(points: TrendPoint[]): TrendPoint[] {
  const m = new Map<string, { sum: number; count: number }>();
  for (const p of points) {
    const cur = m.get(p.date) ?? { sum: 0, count: 0 };
    cur.sum += p.value;
    cur.count += 1;
    m.set(p.date, cur);
  }
  return [...m.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { sum, count }]) => ({ date, value: sum / count }));
}

function mapCohortSummary(r: CohortSummaryResponse, type: "grade" | "subject"): CohortSummary {
  return {
    id: r.id,
    type,
    name: r.name,
    performance: r.performance,
    attendance: r.attendance,
    engagement: r.engagement,
    risk: {
      low: r.risk.low,
      medium: r.risk.medium,
      high: r.risk.high,
      average: r.risk.average,
    },
    interventions: r.interventions,
  };
}

function heatmapCountDeltaLast7VsPrev7(daily: { date: string; count: number }[] | undefined): number {
  const sorted = [...(daily ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return 0;
  const last7 = sorted.slice(-7);
  const prev7 = sorted.length > 7 ? sorted.slice(-14, -7) : [];
  const sumLast = last7.reduce((s, c) => s + c.count, 0);
  const sumPrev = prev7.reduce((s, c) => s + c.count, 0);
  return sumLast - sumPrev;
}

@Injectable()
export class PrincipalReportsService {
  private readonly logger = new Logger(PrincipalReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly risk: RiskService,
    private readonly cohortAnalytics: CohortAnalyticsService,
    private readonly lmsHeatmaps: LmsHeatmapsService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private getAiBaseUrl(): string {
    return (this.config.get<string>("AI_SERVICE_URL") ?? "http://ai:8000").replace(/\/$/, "");
  }

  private async engagementTrendPercent(
    schoolId: string,
    studentIds: string[],
    windowDays: number,
  ): Promise<number> {
    if (!studentIds.length) return 0;
    const now = new Date();
    const lastStart = subDays(now, windowDays);
    const prevStart = subDays(now, windowDays * 2);
    const [lastAgg, prevAgg] = await Promise.all([
      this.prisma.lmsActivityEvent.aggregate({
        where: {
          schoolId,
          studentId: { in: studentIds },
          deletedAt: null,
          occurredAt: { gte: lastStart },
        },
        _avg: { engagementScore: true },
      }),
      this.prisma.lmsActivityEvent.aggregate({
        where: {
          schoolId,
          studentId: { in: studentIds },
          deletedAt: null,
          occurredAt: { gte: prevStart, lt: lastStart },
        },
        _avg: { engagementScore: true },
      }),
    ]);
    const last = lastAgg._avg.engagementScore ? Number(lastAgg._avg.engagementScore) : 0;
    const prev = prevAgg._avg.engagementScore ? Number(prevAgg._avg.engagementScore) : 0;
    if (Math.abs(prev) < 1e-9) return 0;
    return Math.round(((last - prev) / prev) * 1000) / 10;
  }

  private async tryPrincipalAiSummary(payload: Record<string, unknown>): Promise<string | null> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ summary?: string; aiSummary?: string }>(
          `${this.getAiBaseUrl()}/generate-principal-report-summary`,
          payload,
          {
            headers: { "Content-Type": "application/json" },
            timeout: this.config.get<number>("AI_SERVICE_TIMEOUT_MS") ?? 60_000,
          },
        ),
      );
      const s = res.data?.summary ?? res.data?.aiSummary;
      return typeof s === "string" ? s : null;
    } catch (err) {
      if (err instanceof AxiosError) {
        this.logger.warn(`Principal report AI failed: ${err.response?.status ?? err.code}`);
      } else {
        this.logger.warn(`Principal report AI failed: ${err instanceof Error ? err.message : err}`);
      }
      return null;
    }
  }

  private buildSchoolTrends(
    now: Date,
    studentAnalyticsList: Awaited<ReturnType<AnalyticsService["getStudentAnalytics"]>>[],
    classAnalyticsList: Awaited<ReturnType<AnalyticsService["getClassAnalytics"]>>[],
    studentRisks: Awaited<ReturnType<RiskService["getStudentRisk"]>>[],
    schoolEngagementDeltaPct: number,
  ): SchoolTrendSummary {
    const scorePoints = mergeTrendPoints([
      ...studentAnalyticsList.flatMap((a) => a.scoreTimeline ?? []),
      ...classAnalyticsList.flatMap((a) => a.scoreTrend ?? []),
    ]);
    const attPoints = mergeTrendPoints(studentAnalyticsList.flatMap((a) => a.attendanceTimeline ?? []));

    const performanceDelta = trendPctPooled(scorePoints, now, 7);
    const attendanceDelta = trendPctPooled(attPoints, now, 7);
    const engagementDelta = schoolEngagementDeltaPct;

    /** Week-over-week risk change requires historical snapshots; reserved at 0. */
    const riskDelta = 0;

    let highRiskNew = 0;
    for (const r of studentRisks) {
      if (r.level === RiskLevel.HIGH) highRiskNew += 1;
    }

    return {
      performanceDelta,
      attendanceDelta,
      engagementDelta,
      riskDelta,
      highRiskNew,
    };
  }

  /**
   * Builds the principal report. GET and POST are equivalent until caching is added.
   */
  async getPrincipalReport(schoolId: string, user: JwtPayload): Promise<PrincipalReportResponse> {
    const now = new Date();
    const scoped = toPrincipalScope(user, schoolId);
    const weekAgo = subDays(now, 7);
    const heatmapFrom = subDays(now, 14);

    const [classes, students, subjects] = await Promise.all([
      this.prisma.class.findMany({
        where: { schoolId },
        include: {
          subject: true,
          enrollments: {
            where: { status: "active", deletedAt: null },
            include: { student: true },
          },
        },
      }),
      this.prisma.student.findMany({ where: { schoolId } }),
      this.prisma.subject.findMany({ where: { schoolId } }),
    ]);

    const studentIds = students.map((s) => s.id);
    const classIds = classes.map((c) => c.id);

    const [
      studentAnalyticsList,
      classAnalyticsList,
      studentRisks,
      gradeCohorts,
      subjectCohorts,
      createdInterventions,
      resolvedInterventions,
      interventionsForLoad,
      schoolHeatmap,
      engagementDeltaPct,
    ] = await Promise.all([
      studentIds.length
        ? Promise.all(studentIds.map((id) => this.analytics.getStudentAnalytics(id, scoped)))
        : Promise.resolve([]),
      classIds.length
        ? Promise.all(classIds.map((id) => this.analytics.getClassAnalytics(id, scoped)))
        : Promise.resolve([]),
      studentIds.length
        ? Promise.all(studentIds.map((id) => this.risk.getStudentRisk(schoolId, id, scoped)))
        : Promise.resolve([]),
      this.cohortAnalytics.listGradeCohorts(schoolId, user),
      this.cohortAnalytics.listSubjectCohorts(schoolId, user),
      this.prisma.intervention.count({
        where: { schoolId, createdAt: { gte: weekAgo } },
      }),
      this.prisma.intervention.count({
        where: { schoolId, status: "resolved", updatedAt: { gte: weekAgo } },
      }),
      this.prisma.intervention.findMany({
        where: { schoolId, createdAt: { gte: weekAgo } },
        select: { teacherId: true },
      }),
      this.lmsHeatmaps.getSchoolHeatmap(schoolId, scoped, formatYmd(heatmapFrom), formatYmd(now)),
      this.engagementTrendPercent(schoolId, studentIds, 7),
    ]);

    const teacherLoad: Record<string, number> = {};
    for (const row of interventionsForLoad) {
      teacherLoad[row.teacherId] = (teacherLoad[row.teacherId] ?? 0) + 1;
    }

    const resolutionRate =
      createdInterventions > 0
        ? Math.min(1, Math.round((resolvedInterventions / createdInterventions) * 1000) / 1000)
        : 0;

    const schoolTrends = this.buildSchoolTrends(
      now,
      studentAnalyticsList,
      classAnalyticsList,
      studentRisks,
      engagementDeltaPct,
    );

    const cohorts: CohortSummary[] = [
      ...gradeCohorts.map((c) => mapCohortSummary(c, "grade")),
      ...subjectCohorts.map((c) => mapCohortSummary(c, "subject")),
    ];

    let low = 0;
    let medium = 0;
    let high = 0;
    let riskSum = 0;
    for (const r of studentRisks) {
      if (r.level === RiskLevel.LOW) low += 1;
      else if (r.level === RiskLevel.MEDIUM) medium += 1;
      else high += 1;
      riskSum += r.overall;
    }
    const riskAverage =
      studentRisks.length > 0 ? Math.round((riskSum / studentRisks.length) * 10) / 10 : 0;

    const aiSummary = await this.tryPrincipalAiSummary({
      schoolId,
      generatedAt: now.toISOString(),
      scope: {
        classCount: classes.length,
        studentCount: students.length,
        subjectCount: subjects.length,
      },
      schoolTrends,
      cohorts,
      riskDistribution: { low, medium, high, average: riskAverage },
      interventions: {
        created: createdInterventions,
        resolved: resolvedInterventions,
        resolutionRate,
        teacherLoad,
      },
      engagement: {
        heatmapDelta: heatmapCountDeltaLast7VsPrev7(schoolHeatmap.heatmap),
        heatmapWeekly: schoolHeatmap.weekly,
      },
    });

    return {
      schoolId,
      generatedAt: now.toISOString(),
      schoolTrends,
      cohorts,
      interventions: {
        created: createdInterventions,
        resolved: resolvedInterventions,
        resolutionRate,
        teacherLoad,
      },
      engagement: {
        daily: schoolHeatmap.heatmap,
        weekly: schoolHeatmap.weekly,
        engagementDelta: heatmapCountDeltaLast7VsPrev7(schoolHeatmap.heatmap),
      },
      aiSummary,
    };
  }
}
