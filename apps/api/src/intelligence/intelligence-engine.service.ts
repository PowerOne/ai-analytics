import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AxiosError } from "axios";
import type { RowDataPacket } from "mysql2/promise";
import { firstValueFrom } from "rxjs";
import type { JwtPayload } from "../common/types/jwt-payload";
import { UserRole } from "../common/user-role";
import { PrincipalAttendanceEngagementHeatmapService } from "../dashboards/principal-attendance-engagement-heatmap.service";
import type {
  PrincipalAttendanceEngagementHeatmapBlockDto,
  PrincipalAttEngContributorsResponseDto,
} from "../dashboards/dto/principal-attendance-engagement-heatmap.dto";
import type { PrincipalAttEngContributorsQueryDto } from "../dashboards/dto/principal-att-eng-contributors-query.dto";
import { MySQLService } from "../database/mysql.service";
import { aiHttpHeaders } from "../integrations/ai-request-headers";
import { LmsHeatmapsService } from "../lms-heatmaps/lms-heatmaps.service";
import type { CohortSummary } from "../principal-reports/dto/cohort-summary.dto";
import type { SchoolTrendSummary } from "../principal-reports/dto/school-trend.dto";

function toPrincipalScope(user: JwtPayload, schoolId: string): JwtPayload {
  return {
    sub: user.sub,
    email: user.email,
    schoolId,
    role: UserRole.PRINCIPAL,
    teacherId: null,
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

/** Cohort row shape aligned with principal dashboard `cohorts` (delta columns). */
export type PrincipalCohortDashboardRow = {
  cohortType: "GRADE" | "SUBJECT";
  cohortId: string;
  name: string;
  performanceDelta: number;
  attendanceDelta: number;
  engagementDelta: number;
  riskDelta: number;
  risk: { low: number; medium: number; high: number; average: number };
  interventions: number;
};

/** Full snapshot intelligence bundle for `GET .../dashboards/principal`. */
export type SchoolIntelligenceFullBundle = {
  schoolSnapshot: {
    thisWeek: Record<string, unknown> | null;
    lastWeek: Record<string, unknown> | null;
  };
  cohortSnapshots: CohortSummary[];
  cohortDashboard: PrincipalCohortDashboardRow[];
  heatmaps: { daily: unknown[]; weekly: unknown[] };
  attendanceEngagementBlock: PrincipalAttendanceEngagementHeatmapBlockDto;
  deltas: SchoolTrendSummary;
  interventions: { created: number; resolved: number; resolutionRate: number };
  aiSummary: string | null;
  schoolInterventions: unknown[];
};

@Injectable()
export class IntelligenceEngineService {
  private readonly logger = new Logger(IntelligenceEngineService.name);

  constructor(
    private readonly db: MySQLService,
    private readonly lmsHeatmaps: LmsHeatmapsService,
    private readonly principalAttEngHeatmap: PrincipalAttendanceEngagementHeatmapService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private asRows<T extends RowDataPacket>(packet: unknown): T[] {
    return packet as T[];
  }

  private getAiBaseUrl(): string {
    return (this.config.get<string>("AI_SERVICE_URL") ?? "http://ai:8000").replace(/\/$/, "");
  }

  /** Shared AI POST returning `summary` (teacher / cohort / student360 dashboards, interventions tooling). */
  async aiTrySummary(path: string, payload: Record<string, unknown>): Promise<string | null> {
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

  /** POST to AI and parse a JSON array (school interventions, student interventions). */
  async aiPostJsonArray(path: string, payload: Record<string, unknown>): Promise<unknown[]> {
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

  /** Used by DashboardsService for teacher dashboard, student interventions, etc. */
  async loadWeeklySchoolSnapshot(
    schoolId: string,
    weekStart: Date,
  ): Promise<Record<string, unknown> | null> {
    return this.sqlWeeklySchoolSnap(schoolId, weekStart);
  }

  private async sqlWeeklySchoolSnap(
    schoolId: string,
    weekStart: Date,
  ): Promise<Record<string, unknown> | null> {
    const sql = `
      SELECT \`weekStartDate\`, performance, attendance, engagement, \`riskAverage\`, \`riskHigh\`,
             \`riskComposite\`, \`riskCategory\`, \`riskReasons\`, \`riskStability\`, \`riskDeltas\`
      FROM weekly_school_snapshots
      WHERE \`schoolId\` = ? AND \`weekStartDate\` = ?
      LIMIT 1
    `;
    const packet = (await this.db.query(sql, [schoolId, weekStart]))[0] as RowDataPacket[];
    const row = this.asRows<RowDataPacket>(packet)[0];
    return row ? { ...row } : null;
  }

  private async sqlWeeklyCohortSnapsSchoolWeek(
    schoolId: string,
    weekStart: Date,
  ): Promise<Record<string, unknown>[]> {
    const sql = `
      SELECT \`cohortType\`, \`cohortId\`, name, performance, attendance, engagement,
             \`riskLow\`, \`riskMedium\`, \`riskHigh\`, \`riskAverage\`, interventions
      FROM weekly_cohort_snapshots
      WHERE \`schoolId\` = ? AND \`weekStartDate\` = ?
    `;
    const packet = (await this.db.query(sql, [schoolId, weekStart]))[0] as RowDataPacket[];
    return this.asRows<RowDataPacket>(packet).map((r) => ({ ...r }));
  }

  private async sqlInterventionsCreatedInRange(schoolId: string, gte: Date, lt: Date): Promise<number> {
    const sql = `
      SELECT COUNT(*) AS c FROM interventions
      WHERE school_id = ? AND created_at >= ? AND created_at < ?
    `;
    const packet = (await this.db.query(sql, [schoolId, gte, lt]))[0] as RowDataPacket[];
    return Number(this.asRows<RowDataPacket & { c: number }>(packet)[0]?.c ?? 0);
  }

  private async sqlInterventionsResolvedInRange(schoolId: string, gte: Date, lt: Date): Promise<number> {
    const sql = `
      SELECT COUNT(*) AS c FROM interventions
      WHERE school_id = ? AND status = 'resolved' AND updated_at >= ? AND updated_at < ?
    `;
    const packet = (await this.db.query(sql, [schoolId, gte, lt]))[0] as RowDataPacket[];
    return Number(this.asRows<RowDataPacket & { c: number }>(packet)[0]?.c ?? 0);
  }

  private buildPrincipalAttendanceEngagementHeatmap(schoolId: string, fromStr: string, toStr: string) {
    return this.principalAttEngHeatmap.buildSchoolSeries(schoolId, fromStr, toStr);
  }

  /**
   * Drill-down for principal attendance/engagement heatmap buckets (separate from {@link getIntelligenceForSchool} bundle).
   */
  async getPrincipalAttEngContributors(
    schoolId: string,
    query: PrincipalAttEngContributorsQueryDto,
  ): Promise<PrincipalAttEngContributorsResponseDto> {
    return this.principalAttEngHeatmap.getContributors(
      schoolId,
      query.bucketType,
      query.bucketKey,
      query.metric,
      query.limit,
    );
  }

  private mapCohortRowsToPrincipalReportSummaries(cohortThis: Record<string, unknown>[]): CohortSummary[] {
    return cohortThis.map((t) => {
      const cohortType = String(t.cohortType).toUpperCase();
      const type: "grade" | "subject" = cohortType === "GRADE" ? "grade" : "subject";
      return {
        id: String(t.cohortId),
        type,
        name: String(t.name),
        performance: t.performance != null ? Number(t.performance) : 0,
        attendance: t.attendance != null ? Number(t.attendance) : 0,
        engagement: t.engagement != null ? Number(t.engagement) : 0,
        risk: {
          low: t.riskLow != null ? Number(t.riskLow) : 0,
          medium: t.riskMedium != null ? Number(t.riskMedium) : 0,
          high: t.riskHigh != null ? Number(t.riskHigh) : 0,
          average: t.riskAverage != null ? Number(t.riskAverage) : 0,
        },
        interventions: t.interventions != null ? Number(t.interventions) : 0,
      };
    });
  }

  /**
   * Unified snapshot-based intelligence for a school.
   * - `full`: same work as legacy `DashboardsService.getPrincipalDashboard` data path (includes AI).
   * - `cohorts-only`: weekly cohort snapshots → principal-report cohort DTOs (no LMS / AI).
   */
  async getIntelligenceForSchool(
  schoolId: string,
  user: JwtPayload,
  scope: "full" | "cohorts-only" = "full",
  from?: Date,
  to?: Date,
)
  ): Promise<SchoolIntelligenceFullBundle | { cohortSnapshots: CohortSummary[] }> {
    if (scope === "cohorts-only") {
      const thisWeekMonday = mondayUtcContaining(new Date());
      const cohortThis = await this.sqlWeeklyCohortSnapsSchoolWeek(schoolId, thisWeekMonday);
      return { cohortSnapshots: this.mapCohortRowsToPrincipalReportSummaries(cohortThis) };
    }

    const scoped = toPrincipalScope(user, schoolId);
    // If caller provided a date range, use it.
    // Otherwise fall back to existing logic.
const now = to ?? new Date();
const rangeFrom = from ?? new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

const thisWeekMonday = mondayUtcContaining(now);
const lastWeekMonday = new Date(thisWeekMonday);
lastWeekMonday.setUTCDate(lastWeekMonday.getUTCDate() - 7);
const weekEndExclusive = new Date(thisWeekMonday);
weekEndExclusive.setUTCDate(weekEndExclusive.getUTCDate() + 7);

const fromStr = formatYmd(rangeFrom);
const toStr = formatYmd(now);


    const [schoolThis, schoolLast, cohortThis, cohortLast, hm, created, resolved, principalAttendanceEngagementHeatmap] =
      await Promise.all([
        this.sqlWeeklySchoolSnap(schoolId, thisWeekMonday),
        this.sqlWeeklySchoolSnap(schoolId, lastWeekMonday),
        this.sqlWeeklyCohortSnapsSchoolWeek(schoolId, thisWeekMonday),
        this.sqlWeeklyCohortSnapsSchoolWeek(schoolId, lastWeekMonday),
        this.lmsHeatmaps.getSchoolHeatmap(schoolId, scoped, fromStr, toStr),
        this.sqlInterventionsCreatedInRange(schoolId, thisWeekMonday, weekEndExclusive),
        this.sqlInterventionsResolvedInRange(schoolId, thisWeekMonday, weekEndExclusive),
        this.buildPrincipalAttendanceEngagementHeatmap(schoolId, fromStr, toStr),
      ]);

    const lastCohortMap = new Map(
      cohortLast.map((r) => [`${String(r.cohortType)}:${String(r.cohortId)}`, r]),
    );

    const schoolTrends: SchoolTrendSummary = {
      performanceDelta: deltaPerformance(
        schoolThis?.performance != null ? Number(schoolThis.performance) : undefined,
        schoolLast?.performance != null ? Number(schoolLast.performance) : undefined,
      ),
      attendanceDelta: deltaAttendance(
        schoolThis?.attendance != null ? Number(schoolThis.attendance) : undefined,
        schoolLast?.attendance != null ? Number(schoolLast.attendance) : undefined,
      ),
      engagementDelta: deltaEngagement(
        schoolThis?.engagement != null ? Number(schoolThis.engagement) : undefined,
        schoolLast?.engagement != null ? Number(schoolLast.engagement) : undefined,
      ),
      riskDelta: deltaRisk(
        schoolThis?.riskAverage != null ? Number(schoolThis.riskAverage) : undefined,
        schoolLast?.riskAverage != null ? Number(schoolLast.riskAverage) : undefined,
      ),
      highRiskNew: schoolThis?.riskHigh != null ? Number(schoolThis.riskHigh) : 0,
      riskCompositeDelta: deltaCompositeRisk(
        schoolThis?.riskComposite != null ? Number(schoolThis.riskComposite) : undefined,
        schoolLast?.riskComposite != null ? Number(schoolLast.riskComposite) : undefined,
      ),
    };

    const cohortDashboard: PrincipalCohortDashboardRow[] = cohortThis.map((t) => {
      const key = `${String(t.cohortType)}:${String(t.cohortId)}`;
      const l = lastCohortMap.get(key);
      return {
        cohortType: String(t.cohortType) as "GRADE" | "SUBJECT",
        cohortId: String(t.cohortId),
        name: String(t.name),
        performanceDelta: deltaPerformance(
          t.performance != null ? Number(t.performance) : undefined,
          l?.performance != null ? Number(l.performance) : undefined,
        ),
        attendanceDelta: deltaAttendance(
          t.attendance != null ? Number(t.attendance) : undefined,
          l?.attendance != null ? Number(l.attendance) : undefined,
        ),
        engagementDelta: deltaEngagement(
          t.engagement != null ? Number(t.engagement) : undefined,
          l?.engagement != null ? Number(l.engagement) : undefined,
        ),
        riskDelta: deltaRisk(
          t.riskAverage != null ? Number(t.riskAverage) : undefined,
          l?.riskAverage != null ? Number(l.riskAverage) : undefined,
        ),
        risk: {
          low: t.riskLow != null ? Number(t.riskLow) : 0,
          medium: t.riskMedium != null ? Number(t.riskMedium) : 0,
          high: t.riskHigh != null ? Number(t.riskHigh) : 0,
          average: t.riskAverage != null ? Number(t.riskAverage) : 0,
        },
        interventions: t.interventions != null ? Number(t.interventions) : 0,
      };
    });

    const cohortSnapshots = this.mapCohortRowsToPrincipalReportSummaries(cohortThis);

    const resolutionRate =
      created > 0 ? Math.min(1, Math.round((resolved / created) * 1000) / 1000) : 0;

    const schoolContext = {
      thisWeek: schoolThis,
      lastWeek: schoolLast,
      averages: {
        performance: schoolThis?.performance != null ? Number(schoolThis.performance) : null,
        attendance: schoolThis?.attendance != null ? Number(schoolThis.attendance) : null,
        engagement: schoolThis?.engagement != null ? Number(schoolThis.engagement) : null,
      },
      riskComposite: schoolThis?.riskComposite != null ? Number(schoolThis.riskComposite) : null,
      riskCompositeDelta: deltaCompositeRisk(
        schoolThis?.riskComposite != null ? Number(schoolThis.riskComposite) : undefined,
        schoolLast?.riskComposite != null ? Number(schoolLast.riskComposite) : undefined,
      ),
    };

    const schoolRiskHistory = {
      composite: schoolThis?.riskComposite != null ? Number(schoolThis.riskComposite) : null,
      category: schoolThis?.riskCategory != null ? String(schoolThis.riskCategory) : null,
      reasons: Array.isArray(schoolThis?.riskReasons) ? (schoolThis.riskReasons as string[]) : [],
      stability: schoolThis?.riskStability != null ? Number(schoolThis.riskStability) : null,
      deltas: (schoolThis?.riskDeltas as Record<string, unknown> | null) ?? null,
    };

    const schoolInterventions = await this.aiPostJsonArray("/generate-school-interventions", {
      school: schoolContext,
      trends: schoolTrends,
      riskEngineHistory: schoolRiskHistory,
    });

    const aiSummary = await this.aiTrySummary("/generate-principal-dashboard-summary", {
      schoolId,
      schoolTrends,
      cohorts: cohortDashboard,
      interventions: { created, resolved, resolutionRate },
      schoolInterventions,
      riskEngine: null,
      riskEngineHistory: schoolRiskHistory,
    });

    return {
      schoolSnapshot: { thisWeek: schoolThis, lastWeek: schoolLast },
      cohortSnapshots,
      cohortDashboard,
      heatmaps: { daily: hm.heatmap, weekly: hm.weekly },
      attendanceEngagementBlock: principalAttendanceEngagementHeatmap,
      deltas: schoolTrends,
      interventions: { created, resolved, resolutionRate },
      aiSummary,
      schoolInterventions,
    };
  }
}
