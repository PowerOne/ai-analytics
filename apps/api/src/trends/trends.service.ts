import { Injectable } from "@nestjs/common";
import type { RowDataPacket } from "mysql2/promise";
import { AnalyticsService } from "../analytics/analytics.service";
import { UserRole } from "../common/user-role";
import type { TrendPoint } from "../analytics/dto/common.dto";
import type { JwtPayload } from "../common/types/jwt-payload";
import type { HeatmapCell } from "../lms-heatmaps/dto/heatmap-cell.dto";
import { MySQLService } from "../database/mysql.service";
import { TrendDeltaDto } from "./dto/trend-delta.dto";
import { TrendWindowDto } from "./dto/trend-window.dto";

type AvgEngRow = RowDataPacket & { avgEng: number | null };

type StudentSnapTrendRow = RowDataPacket & {
  performance: number | null;
  attendance: number | null;
  engagement: number | null;
  riskScore: number | null;
  riskTier: string | null;
};

type ClassSnapTrendRow = RowDataPacket & {
  performance: number | null;
  attendance: number | null;
  engagement: number | null;
  riskScore: number | null;
};

type CohortSnapTrendRow = RowDataPacket & {
  performance: number | null;
  attendance: number | null;
  engagement: number | null;
  riskAverage: number | null;
};

type SchoolSnapTrendRow = RowDataPacket & {
  performance: number | null;
  attendance: number | null;
  engagement: number | null;
  riskAverage: number | null;
  riskHigh: number | null;
};

type StudentIdRow = RowDataPacket & { studentId: string };

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
    private readonly db: MySQLService,
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
    const [lastQ, prevQ] = await Promise.all([
      this.db.query(lastSql, [...baseParams, lastStart]),
      this.db.query(prevSql, [...baseParams, prevStart, lastStart]),
    ]);
    const lastRows = lastQ[0] as AvgEngRow[];
    const prevRows = prevQ[0] as AvgEngRow[];
    const last = lastRows[0]?.avgEng != null ? Number(lastRows[0].avgEng) : 0;
    const prev = prevRows[0]?.avgEng != null ? Number(prevRows[0].avgEng) : 0;
    return Math.round((last - prev) * 1000) / 1000;
  }

  private async findWeeklyStudentSnapForTrend(
    schoolId: string,
    studentId: string,
    weekStart: Date,
  ): Promise<StudentSnapTrendRow | null> {
    const sql = `
      SELECT performance, attendance, engagement, \`riskScore\`, \`riskTier\`
      FROM weekly_student_snapshots
      WHERE \`schoolId\` = ? AND \`studentId\` = ? AND \`weekStartDate\` = ?
      LIMIT 1
    `;
    const packet = (await this.db.query(sql, [
      schoolId,
      studentId,
      weekStart,
    ]))[0] as StudentSnapTrendRow[];
    const rows = packet as StudentSnapTrendRow[];
    return rows[0] ?? null;
  }

  private async findWeeklyClassSnapForTrend(
    schoolId: string,
    classId: string,
    weekStart: Date,
  ): Promise<ClassSnapTrendRow | null> {
    const sql = `
      SELECT performance, attendance, engagement, \`riskScore\`
      FROM weekly_class_snapshots
      WHERE \`schoolId\` = ? AND \`classId\` = ? AND \`weekStartDate\` = ?
      LIMIT 1
    `;
    const packet = (await this.db.query(sql, [schoolId, classId, weekStart]))[0] as ClassSnapTrendRow[];
    const rows = packet as ClassSnapTrendRow[];
    return rows[0] ?? null;
  }

  private async findWeeklyCohortSnapForTrend(
    schoolId: string,
    cohortType: string,
    cohortId: string,
    weekStart: Date,
  ): Promise<CohortSnapTrendRow | null> {
    const sql = `
      SELECT performance, attendance, engagement, \`riskAverage\`
      FROM weekly_cohort_snapshots
      WHERE \`schoolId\` = ? AND \`cohortType\` = ? AND \`cohortId\` = ? AND \`weekStartDate\` = ?
      LIMIT 1
    `;
    const packet = (await this.db.query(sql, [
      schoolId,
      cohortType,
      cohortId,
      weekStart,
    ]))[0] as CohortSnapTrendRow[];
    const rows = packet as CohortSnapTrendRow[];
    return rows[0] ?? null;
  }

  private async findWeeklySchoolSnapForTrend(
    schoolId: string,
    weekStart: Date,
  ): Promise<SchoolSnapTrendRow | null> {
    const sql = `
      SELECT performance, attendance, engagement, \`riskAverage\`, \`riskHigh\`
      FROM weekly_school_snapshots
      WHERE \`schoolId\` = ? AND \`weekStartDate\` = ?
      LIMIT 1
    `;
    const packet = (await this.db.query(sql, [schoolId, weekStart]))[0] as SchoolSnapTrendRow[];
    const rows = packet as SchoolSnapTrendRow[];
    return rows[0] ?? null;
  }

  private async classEnrollmentStudentIds(schoolId: string, classId: string): Promise<string[]> {
    const sql = `
      SELECT DISTINCT student_id AS studentId FROM enrollments
      WHERE school_id = ? AND class_id = ? AND deleted_at IS NULL AND status = 'active'
    `;
    const packet = (await this.db.query(sql, [schoolId, classId]))[0] as StudentIdRow[];
    return (packet as StudentIdRow[]).map((r) => r.studentId);
  }

  async getStudentTrend(
    studentId: string,
    schoolId: string,
    user?: JwtPayload,
  ): Promise<TrendDeltaDto> {
    const { thisWeekMonday, lastWeekMonday } = this.weekDates();
    const scoped = this.scoped(user, schoolId);

    const [t, l] = await Promise.all([
      this.findWeeklyStudentSnapForTrend(schoolId, studentId, thisWeekMonday),
      this.findWeeklyStudentSnapForTrend(schoolId, studentId, lastWeekMonday),
    ]);

    if (t && l) {
      const highRiskNew =
        isHighSnapshotTier(t.riskTier) && !isHighSnapshotTier(l.riskTier) ? 1 : 0;
      return {
        performanceDelta: deltaPerformance(
          t.performance != null ? Number(t.performance) : null,
          l.performance != null ? Number(l.performance) : null,
        ),
        attendanceDelta: deltaAttendance(
          t.attendance != null ? Number(t.attendance) : null,
          l.attendance != null ? Number(l.attendance) : null,
        ),
        engagementDelta: deltaEngagement(
          t.engagement != null ? Number(t.engagement) : null,
          l.engagement != null ? Number(l.engagement) : null,
        ),
        riskDelta: deltaRisk(
          t.riskScore != null ? Number(t.riskScore) : null,
          l.riskScore != null ? Number(l.riskScore) : null,
        ),
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
      this.findWeeklyClassSnapForTrend(schoolId, classId, thisWeekMonday),
      this.findWeeklyClassSnapForTrend(schoolId, classId, lastWeekMonday),
    ]);

    if (t && l) {
      return {
        performanceDelta: deltaPerformance(
          t.performance != null ? Number(t.performance) : null,
          l.performance != null ? Number(l.performance) : null,
        ),
        attendanceDelta: deltaAttendance(
          t.attendance != null ? Number(t.attendance) : null,
          l.attendance != null ? Number(l.attendance) : null,
        ),
        engagementDelta: deltaEngagement(
          t.engagement != null ? Number(t.engagement) : null,
          l.engagement != null ? Number(l.engagement) : null,
        ),
        riskDelta: deltaRisk(
          t.riskScore != null ? Number(t.riskScore) : null,
          l.riskScore != null ? Number(l.riskScore) : null,
        ),
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

    const studentIds = await this.classEnrollmentStudentIds(schoolId, classId);
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
      this.findWeeklyCohortSnapForTrend(schoolId, cohortType, cohortId, thisWeekMonday),
      this.findWeeklyCohortSnapForTrend(schoolId, cohortType, cohortId, lastWeekMonday),
    ]);

    if (t && l) {
      return {
        performanceDelta: deltaPerformance(
          t.performance != null ? Number(t.performance) : null,
          l.performance != null ? Number(l.performance) : null,
        ),
        attendanceDelta: deltaAttendance(
          t.attendance != null ? Number(t.attendance) : null,
          l.attendance != null ? Number(l.attendance) : null,
        ),
        engagementDelta: deltaEngagement(
          t.engagement != null ? Number(t.engagement) : null,
          l.engagement != null ? Number(l.engagement) : null,
        ),
        riskDelta: deltaRisk(
          t.riskAverage != null ? Number(t.riskAverage) : null,
          l.riskAverage != null ? Number(l.riskAverage) : null,
        ),
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
      this.findWeeklySchoolSnapForTrend(schoolId, thisWeekMonday),
      this.findWeeklySchoolSnapForTrend(schoolId, lastWeekMonday),
    ]);

    if (t && l) {
      return {
        performanceDelta: deltaPerformance(
          t.performance != null ? Number(t.performance) : null,
          l.performance != null ? Number(l.performance) : null,
        ),
        attendanceDelta: deltaAttendance(
          t.attendance != null ? Number(t.attendance) : null,
          l.attendance != null ? Number(l.attendance) : null,
        ),
        engagementDelta: deltaEngagement(
          t.engagement != null ? Number(t.engagement) : null,
          l.engagement != null ? Number(l.engagement) : null,
        ),
        riskDelta: deltaRisk(
          t.riskAverage != null ? Number(t.riskAverage) : null,
          l.riskAverage != null ? Number(l.riskAverage) : null,
        ),
        highRiskNew: t.riskHigh != null ? Number(t.riskHigh) : 0,
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
