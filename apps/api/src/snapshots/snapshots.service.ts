import { Injectable, Logger } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AnalyticsService } from "../analytics/analytics.service";
import type { TrendPoint } from "../analytics/dto/common.dto";
import { CohortAnalyticsService } from "../cohort-analytics/cohort-analytics.service";
import type { JwtPayload } from "../common/types/jwt-payload";
import { LmsHeatmapsService } from "../lms-heatmaps/lms-heatmaps.service";
import { PrismaService } from "../prisma/prisma.service";
import { RiskService } from "../risk/risk.service";
import { RiskLevel } from "../risk/dto/risk-level.enum";

function formatYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
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

/**
 * Monday UTC of the week that just ended (the completed Mon–Sun block before the current UTC week).
 * Intended when the cron runs Monday 02:00 UTC.
 */
export function weekStartMondayUtcOfLastCompletedWeek(now: Date): Date {
  const thisMonday = mondayUtcContaining(now);
  const prev = new Date(thisMonday);
  prev.setUTCDate(thisMonday.getUTCDate() - 7);
  return prev;
}

function endOfWeekInclusiveUtc(weekStartMonday: Date): Date {
  const end = new Date(weekStartMonday);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

function meanTimeline(points: TrendPoint[]): number | null {
  const vals = points.filter((p) => Number.isFinite(p.value)).map((p) => p.value);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function principalScope(schoolId: string): JwtPayload {
  return {
    sub: "system-weekly-snapshots",
    email: "system@snapshots.internal",
    schoolId,
    role: UserRole.PRINCIPAL,
    teacherId: null,
  };
}

function riskTierSnapshot(level: RiskLevel): string {
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

const BATCH = 32;

async function mapInBatches<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    const part = await Promise.all(chunk.map((x) => fn(x)));
    out.push(...part);
  }
  return out;
}

@Injectable()
export class SnapshotsService {
  private readonly logger = new Logger(SnapshotsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly risk: RiskService,
    private readonly lmsHeatmaps: LmsHeatmapsService,
    private readonly cohortAnalytics: CohortAnalyticsService,
  ) {}

  async runWeeklySnapshot(): Promise<void> {
    const now = new Date();
    const weekStart = weekStartMondayUtcOfLastCompletedWeek(now);
    const weekEndInclusive = endOfWeekInclusiveUtc(weekStart);
    const fromStr = formatYmd(weekStart);
    const toStr = weekEndInclusive.toISOString();

    this.logger.log(
      `Weekly snapshots: weekStartDate=${fromStr} (UTC Mon), window to ${toStr}`,
    );

    const schools = await this.prisma.school.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });

    const settled = await Promise.allSettled(
      schools.map((s) => this.snapshotSchool(s.id, weekStart, fromStr, toStr)),
    );
    let ok = 0;
    for (let i = 0; i < settled.length; i++) {
      const r = settled[i]!;
      if (r.status === "fulfilled") ok += 1;
      else this.logger.error(`Snapshot failed for school ${schools[i]!.id}: ${r.reason}`);
    }
    this.logger.log(`Weekly snapshots: ${ok}/${schools.length} school(s) completed without errors.`);
  }

  private async snapshotSchool(
    schoolId: string,
    weekStart: Date,
    fromStr: string,
    toStr: string,
  ): Promise<void> {
    const existing = await this.prisma.weeklySchoolSnapshot.findFirst({
      where: { schoolId, weekStartDate: weekStart },
    });
    if (existing) {
      this.logger.warn(`Skipping school ${schoolId}: snapshot already exists for ${fromStr}`);
      return;
    }

    const scoped = principalScope(schoolId);

    const [classes, students, _subjects] = await Promise.all([
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
    void _subjects;

    const weekEndExclusive = new Date(weekStart);
    weekEndExclusive.setUTCDate(weekEndExclusive.getUTCDate() + 7);

    const studentRows = await mapInBatches(students, async (st) => {
      try {
        const [a, r, hm] = await Promise.all([
          this.analytics.getStudentAnalytics(st.id, scoped),
          this.risk.getStudentRisk(schoolId, st.id, scoped),
          this.lmsHeatmaps.getStudentHeatmap(schoolId, st.id, scoped, fromStr, toStr),
        ]);
        const performance = meanTimeline(a.scoreTimeline ?? []);
        const attendance = meanTimeline(a.attendanceTimeline ?? []);
        const engagement = (hm.heatmap ?? []).reduce((s, c) => s + c.count, 0);
        return {
          schoolId,
          studentId: st.id,
          weekStartDate: weekStart,
          performance: performance ?? undefined,
          attendance: attendance ?? undefined,
          engagement,
          riskScore: r.overall,
          riskTier: riskTierSnapshot(r.level),
        };
      } catch (e) {
        this.logger.warn(`Student ${st.id} snapshot skipped: ${e instanceof Error ? e.message : e}`);
        return null;
      }
    });

    const studentData = studentRows.filter((x): x is NonNullable<typeof x> => x != null);

    const classRows = await mapInBatches(classes, async (cls) => {
      try {
        const [a, r, hm] = await Promise.all([
          this.analytics.getClassAnalytics(cls.id, scoped),
          this.risk.getClassRisk(schoolId, cls.id, scoped),
          this.lmsHeatmaps.getClassHeatmap(schoolId, cls.id, scoped, fromStr, toStr),
        ]);
        const engagement = (hm.heatmap ?? []).reduce((s, c) => s + c.count, 0);
        return {
          schoolId,
          classId: cls.id,
          weekStartDate: weekStart,
          performance: a.averageScore ?? undefined,
          attendance: a.attendanceRate ?? undefined,
          engagement,
          riskScore: r.overall,
        };
      } catch (e) {
        this.logger.warn(`Class ${cls.id} snapshot skipped: ${e instanceof Error ? e.message : e}`);
        return null;
      }
    });

    const classData = classRows.filter((x): x is NonNullable<typeof x> => x != null);

    const [gradeCohorts, subjectCohorts] = await Promise.all([
      this.cohortAnalytics.listGradeCohorts(schoolId, scoped),
      this.cohortAnalytics.listSubjectCohorts(schoolId, scoped),
    ]);

    const cohortData = [
      ...gradeCohorts.map((c) => ({
        schoolId,
        cohortType: "GRADE",
        cohortId: c.id,
        name: c.name,
        weekStartDate: weekStart,
        performance: c.performance ?? undefined,
        attendance: c.attendance ?? undefined,
        engagement: c.engagement ?? undefined,
        riskLow: c.risk.low,
        riskMedium: c.risk.medium,
        riskHigh: c.risk.high,
        riskAverage: c.risk.average,
        interventions: c.interventions,
      })),
      ...subjectCohorts.map((c) => ({
        schoolId,
        cohortType: "SUBJECT",
        cohortId: c.id,
        name: c.name,
        weekStartDate: weekStart,
        performance: c.performance ?? undefined,
        attendance: c.attendance ?? undefined,
        engagement: c.engagement ?? undefined,
        riskLow: c.risk.low,
        riskMedium: c.risk.medium,
        riskHigh: c.risk.high,
        riskAverage: c.risk.average,
        interventions: c.interventions,
      })),
    ];

    let low = 0;
    let medium = 0;
    let high = 0;
    let riskSum = 0;
    let riskN = 0;
    for (const s of studentData) {
      if (s.riskTier === "LOW") low += 1;
      else if (s.riskTier === "MEDIUM") medium += 1;
      else if (s.riskTier === "HIGH") high += 1;
      if (s.riskScore != null) {
        riskSum += s.riskScore;
        riskN += 1;
      }
    }
    const riskAverage = riskN ? Math.round((riskSum / riskN) * 10) / 10 : null;

    const [interventionsCreated, interventionsResolved] = await Promise.all([
      this.prisma.intervention.count({
        where: {
          schoolId,
          createdAt: { gte: weekStart, lt: weekEndExclusive },
        },
      }),
      this.prisma.intervention.count({
        where: {
          schoolId,
          status: "resolved",
          updatedAt: { gte: weekStart, lt: weekEndExclusive },
        },
      }),
    ]);

    const sp = studentData.map((s) => s.performance).filter((x): x is number => x != null);
    const sa = studentData.map((s) => s.attendance).filter((x): x is number => x != null);
    const se = studentData.map((s) => s.engagement).filter((x): x is number => x != null);
    const cp = classData.map((c) => c.performance).filter((x): x is number => x != null);
    const ca = classData.map((c) => c.attendance).filter((x): x is number => x != null);
    const ce = classData.map((c) => c.engagement).filter((x): x is number => x != null);

    const schoolPerformance =
      sp.length && cp.length
        ? (sp.reduce((a, b) => a + b, 0) / sp.length + cp.reduce((a, b) => a + b, 0) / cp.length) / 2
        : sp.length
          ? sp.reduce((a, b) => a + b, 0) / sp.length
          : cp.length
            ? cp.reduce((a, b) => a + b, 0) / cp.length
            : null;
    const schoolAttendance =
      sa.length && ca.length
        ? (sa.reduce((a, b) => a + b, 0) / sa.length + ca.reduce((a, b) => a + b, 0) / ca.length) / 2
        : sa.length
          ? sa.reduce((a, b) => a + b, 0) / sa.length
          : ca.length
            ? ca.reduce((a, b) => a + b, 0) / ca.length
            : null;
    const schoolEngagement =
      se.length && ce.length
        ? (se.reduce((a, b) => a + b, 0) / se.length + ce.reduce((a, b) => a + b, 0) / ce.length) / 2
        : se.length
          ? se.reduce((a, b) => a + b, 0) / se.length
          : ce.length
            ? ce.reduce((a, b) => a + b, 0) / ce.length
            : null;

    await this.prisma.$transaction(async (tx) => {
      if (studentData.length) {
        await tx.weeklyStudentSnapshot.createMany({ data: studentData });
      }
      if (classData.length) {
        await tx.weeklyClassSnapshot.createMany({ data: classData });
      }
      if (cohortData.length) {
        await tx.weeklyCohortSnapshot.createMany({ data: cohortData });
      }
      await tx.weeklySchoolSnapshot.create({
        data: {
          schoolId,
          weekStartDate: weekStart,
          performance: schoolPerformance ?? undefined,
          attendance: schoolAttendance ?? undefined,
          engagement: schoolEngagement ?? undefined,
          riskLow: low,
          riskMedium: medium,
          riskHigh: high,
          riskAverage: riskAverage ?? undefined,
          interventionsCreated,
          interventionsResolved,
        },
      });
    });

    this.logger.log(
      `School ${schoolId}: wrote ${studentData.length} students, ${classData.length} classes, ${cohortData.length} cohorts, 1 school row.`,
    );
  }
}
