import { Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AnalyticsService } from "../analytics/analytics.service";
import type { TrendPoint } from "../analytics/dto/common.dto";
import type { JwtPayload } from "../common/types/jwt-payload";
import type { HeatmapCell } from "../lms-heatmaps/dto/heatmap-cell.dto";
import { PrismaService } from "../prisma/prisma.service";
import { TrendDeltaDto } from "./dto/trend-delta.dto";
import { TrendWindowDto } from "./dto/trend-window.dto";

function toPrincipalScope(schoolId: string): JwtPayload {
  return {
    sub: "trends-service",
    email: "trends@internal",
    schoolId,
    role: UserRole.PRINCIPAL,
    teacherId: null,
  };
}

function mondayUtcContaining(d: Date): Date {
  const x = new Date(d);
  const day = x.getUTCDay();
  const diff = (day + 6) % 7;
  x.setUTCDate(x.getUTCDate() - diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function subDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() - n);
  return x;
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

function isHighSnapshotTier(t: string | null | undefined): boolean {
  return (t ?? "").toUpperCase() === "HIGH";
}

@Injectable()
export class TrendService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  getWeekBoundaries(): TrendWindowDto {
    const now = new Date();
    const thisWeekStart = mondayUtcContaining(now);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);
    return {
      thisWeekStart: thisWeekStart.toISOString(),
      lastWeekStart: lastWeekStart.toISOString(),
    };
  }

  private weekDates(): { thisWeekMonday: Date; lastWeekMonday: Date } {
    const now = new Date();
    const thisWeekMonday = mondayUtcContaining(now);
    const lastWeekMonday = new Date(thisWeekMonday);
    lastWeekMonday.setUTCDate(lastWeekMonday.getUTCDate() - 7);
    return { thisWeekMonday, lastWeekMonday };
  }

  private scoped(user: JwtPayload | undefined, schoolId: string): JwtPayload {
    return user ?? toPrincipalScope(schoolId);
  }

  /**
   * Sum of daily bucket counts in the last 7 buckets minus the previous 7 (by sorted date).
   */
  getEngagementDeltaFromHeatmap(heatmapDaily: HeatmapCell[]): number {
    const sorted = [...heatmapDaily].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length === 0) return 0;
    const last7 = sorted.slice(-7);
    const prev7 = sorted.length > 7 ? sorted.slice(-14, -7) : [];
    const sumLast = last7.reduce((s, c) => s + c.count, 0);
    const sumPrev = prev7.reduce((s, c) => s + c.count, 0);
    return sumLast - sumPrev;
  }

  private async engagementAvgDelta(
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
    return Math.round((last - prev) * 1000) / 1000;
  }

  async getStudentTrend(
    studentId: string,
    schoolId: string,
    user?: JwtPayload,
  ): Promise<TrendDeltaDto> {
    const { thisWeekMonday, lastWeekMonday } = this.weekDates();
    const scoped = this.scoped(user, schoolId);

    const [t, l] = await Promise.all([
      this.prisma.weeklyStudentSnapshot.findFirst({
        where: { schoolId, studentId, weekStartDate: thisWeekMonday },
      }),
      this.prisma.weeklyStudentSnapshot.findFirst({
        where: { schoolId, studentId, weekStartDate: lastWeekMonday },
      }),
    ]);

    if (t && l) {
      const highRiskNew =
        isHighSnapshotTier(t.riskTier) && !isHighSnapshotTier(l.riskTier) ? 1 : 0;
      return {
        performanceDelta: deltaPerformance(t.performance, l.performance),
        attendanceDelta: deltaAttendance(t.attendance, l.attendance),
        engagementDelta: deltaEngagement(t.engagement, l.engagement),
        riskDelta: deltaRisk(t.riskScore, l.riskScore),
        highRiskNew,
      };
    }

    const now = new Date();
    const lastStart = subDays(now, 7);
    const prevStart = subDays(now, 14);
    const prevEnd = subDays(now, 7);

    const a = await this.analytics.getStudentAnalytics(studentId, scoped);

    const perfThis = meanInRange(a.scoreTimeline ?? [], lastStart, now);
    const perfPrev = meanInRange(a.scoreTimeline ?? [], prevStart, prevEnd);
    const performanceDelta =
      perfThis != null && perfPrev != null
        ? Math.round((perfThis - perfPrev) * 10) / 10
        : 0;

    const attThis = meanInRange(a.attendanceTimeline ?? [], lastStart, now);
    const attPrev = meanInRange(a.attendanceTimeline ?? [], prevStart, prevEnd);
    const attendanceDelta =
      attThis != null && attPrev != null
        ? Math.round((attThis - attPrev) * 1000) / 1000
        : 0;

    const engagementDelta = await this.engagementAvgDelta(schoolId, [studentId], 7);

    return {
      performanceDelta,
      attendanceDelta,
      engagementDelta,
      riskDelta: 0,
    };
  }

  async getClassTrend(classId: string, schoolId: string, user?: JwtPayload): Promise<TrendDeltaDto> {
    const { thisWeekMonday, lastWeekMonday } = this.weekDates();
    const scoped = this.scoped(user, schoolId);

    const [t, l] = await Promise.all([
      this.prisma.weeklyClassSnapshot.findFirst({
        where: { schoolId, classId, weekStartDate: thisWeekMonday },
      }),
      this.prisma.weeklyClassSnapshot.findFirst({
        where: { schoolId, classId, weekStartDate: lastWeekMonday },
      }),
    ]);

    if (t && l) {
      return {
        performanceDelta: deltaPerformance(t.performance, l.performance),
        attendanceDelta: deltaAttendance(t.attendance, l.attendance),
        engagementDelta: deltaEngagement(t.engagement, l.engagement),
        riskDelta: deltaRisk(t.riskScore, l.riskScore),
      };
    }

    const now = new Date();
    const lastStart = subDays(now, 7);
    const prevStart = subDays(now, 14);
    const prevEnd = subDays(now, 7);

    const ca = await this.analytics.getClassAnalytics(classId, scoped);
    const perfThis = meanInRange(ca.scoreTrend ?? [], lastStart, now);
    const perfPrev = meanInRange(ca.scoreTrend ?? [], prevStart, prevEnd);
    const performanceDelta =
      perfThis != null && perfPrev != null
        ? Math.round((perfThis - perfPrev) * 10) / 10
        : 0;

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        schoolId,
        classId,
        deletedAt: null,
        status: "active",
      },
      select: { studentId: true },
    });
    const studentIds = enrollments.map((e) => e.studentId);
    const engagementDelta = await this.engagementAvgDelta(schoolId, studentIds, 7);

    return {
      performanceDelta,
      attendanceDelta: 0,
      engagementDelta,
      riskDelta: 0,
    };
  }

  async getCohortTrend(
    cohortType: "GRADE" | "SUBJECT",
    cohortId: string,
    schoolId: string,
  ): Promise<TrendDeltaDto> {
    const { thisWeekMonday, lastWeekMonday } = this.weekDates();

    const [t, l] = await Promise.all([
      this.prisma.weeklyCohortSnapshot.findFirst({
        where: { schoolId, cohortType, cohortId, weekStartDate: thisWeekMonday },
      }),
      this.prisma.weeklyCohortSnapshot.findFirst({
        where: { schoolId, cohortType, cohortId, weekStartDate: lastWeekMonday },
      }),
    ]);

    if (t && l) {
      return {
        performanceDelta: deltaPerformance(t.performance, l.performance),
        attendanceDelta: deltaAttendance(t.attendance, l.attendance),
        engagementDelta: deltaEngagement(t.engagement, l.engagement),
        riskDelta: deltaRisk(t.riskAverage, l.riskAverage),
      };
    }

    return {
      performanceDelta: 0,
      attendanceDelta: 0,
      engagementDelta: 0,
      riskDelta: 0,
    };
  }

  async getSchoolTrend(schoolId: string): Promise<TrendDeltaDto> {
    const { thisWeekMonday, lastWeekMonday } = this.weekDates();

    const [t, l] = await Promise.all([
      this.prisma.weeklySchoolSnapshot.findFirst({
        where: { schoolId, weekStartDate: thisWeekMonday },
      }),
      this.prisma.weeklySchoolSnapshot.findFirst({
        where: { schoolId, weekStartDate: lastWeekMonday },
      }),
    ]);

    if (t && l) {
      return {
        performanceDelta: deltaPerformance(t.performance, l.performance),
        attendanceDelta: deltaAttendance(t.attendance, l.attendance),
        engagementDelta: deltaEngagement(t.engagement, l.engagement),
        riskDelta: deltaRisk(t.riskAverage, l.riskAverage),
        highRiskNew: t.riskHigh ?? 0,
      };
    }

    return {
      performanceDelta: 0,
      attendanceDelta: 0,
      engagementDelta: 0,
      riskDelta: 0,
    };
  }
}
