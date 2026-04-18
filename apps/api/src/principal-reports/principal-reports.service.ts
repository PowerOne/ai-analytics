import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AxiosError } from "axios";
import type { RowDataPacket } from "mysql2/promise";
import { firstValueFrom } from "rxjs";
import { AnalyticsService } from "../analytics/analytics.service";
import { aiHttpHeaders } from "../integrations/ai-request-headers";
import type { TrendPoint } from "../analytics/dto/common.dto";
import { UserRole } from "../common/user-role";
import type { JwtPayload } from "../common/types/jwt-payload";
import { LmsHeatmapsService } from "../lms-heatmaps/lms-heatmaps.service";
import { IntelligenceEngineService } from "../intelligence/intelligence-engine.service";
import { MySQLService } from "../database/mysql.service";
import { RiskService } from "../risk/risk.service";
import { RiskLevel } from "../risk/dto/risk-level.enum";
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

type IdRow = RowDataPacket & { id: string };

type CountRow = RowDataPacket & { c: number };

type AvgEngRow = RowDataPacket & { avgEng: number | null };

type TeacherIdRow = RowDataPacket & { teacherId: string };

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
    private readonly db: MySQLService,
    private readonly analytics: AnalyticsService,
    private readonly risk: RiskService,
    private readonly intelligenceEngine: IntelligenceEngineService,
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
    const placeholders = studentIds.map(() => "?").join(", ");
    const baseParams = [schoolId, ...studentIds];
    const lastSql = `
      SELECT AVG(engagement_score) AS avgEng
      FROM lms_activity_events
      WHERE school_id = ?
        AND student_id IN (${placeholders})
        AND deleted_at IS NULL
        AND occurred_at >= ?
    `;
    const prevSql = `
      SELECT AVG(engagement_score) AS avgEng
      FROM lms_activity_events
      WHERE school_id = ?
        AND student_id IN (${placeholders})
        AND deleted_at IS NULL
        AND occurred_at >= ?
        AND occurred_at < ?
    `;
    const [lastPacket, prevPacket] = await Promise.all([
      this.db.query(lastSql, [...baseParams, lastStart]),
      this.db.query(prevSql, [...baseParams, prevStart, lastStart]),
    ]);
    const lastRows = lastPacket[0] as AvgEngRow[];
    const prevRows = prevPacket[0] as AvgEngRow[];
    const last = lastRows[0]?.avgEng != null ? Number(lastRows[0].avgEng) : 0;
    const prev = prevRows[0]?.avgEng != null ? Number(prevRows[0].avgEng) : 0;
    if (Math.abs(prev) < 1e-9) return 0;
    return Math.round(((last - prev) / prev) * 1000) / 10;
  }

  private async principalInterventionCreatedCount(schoolId: string, since: Date): Promise<number> {
    const sql = `SELECT COUNT(*) AS c FROM interventions WHERE school_id = ? AND created_at >= ?`;
    const packet = (await this.db.query(sql, [schoolId, since]))[0] as CountRow[];
    const rows = packet as CountRow[];
    return Number(rows[0]?.c ?? 0);
  }

  private async principalInterventionResolvedCount(schoolId: string, since: Date): Promise<number> {
    const sql = `
      SELECT COUNT(*) AS c FROM interventions
      WHERE school_id = ? AND status = 'resolved' AND updated_at >= ?
    `;
    const packet = (await this.db.query(sql, [schoolId, since]))[0] as CountRow[];
    const rows = packet as CountRow[];
    return Number(rows[0]?.c ?? 0);
  }

  private async principalInterventionsForTeacherLoad(schoolId: string, since: Date): Promise<TeacherIdRow[]> {
    const sql = `
      SELECT teacher_id AS teacherId FROM interventions
      WHERE school_id = ? AND created_at >= ?
    `;
    const packet = (await this.db.query(sql, [schoolId, since]))[0] as TeacherIdRow[];
    return packet as TeacherIdRow[];
  }

  private async tryPrincipalAiSummary(payload: Record<string, unknown>): Promise<string | null> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ summary?: string; aiSummary?: string }>(
          `${this.getAiBaseUrl()}/generate-principal-report-summary`,
          payload,
          {
            headers: aiHttpHeaders(this.config),
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
      riskCompositeDelta: 0,
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

    const [classesPacket, studentsPacket, subjectsPacket] = await Promise.all([
      this.db.query(`SELECT id FROM classes WHERE school_id = ?`, [schoolId]),
      this.db.query(`SELECT id FROM students WHERE school_id = ?`, [schoolId]),
      this.db.query(`SELECT id FROM subjects WHERE school_id = ?`, [schoolId]),
    ]);
    const classes = classesPacket[0] as IdRow[];
    const students = studentsPacket[0] as IdRow[];
    const subjects = subjectsPacket[0] as IdRow[];

    const studentIds = students.map((s) => s.id);
    const classIds = classes.map((c) => c.id);

    const intel = await this.intelligenceEngine.getIntelligenceForSchool(schoolId, user, "cohorts-only");
    const cohorts = intel.cohortSnapshots;

    const [
      studentAnalyticsList,
      classAnalyticsList,
      studentRisks,
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
      this.principalInterventionCreatedCount(schoolId, weekAgo),
      this.principalInterventionResolvedCount(schoolId, weekAgo),
      this.principalInterventionsForTeacherLoad(schoolId, weekAgo),
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
