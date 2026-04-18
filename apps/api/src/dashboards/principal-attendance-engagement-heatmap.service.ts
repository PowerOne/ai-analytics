import { BadRequestException, Injectable } from "@nestjs/common";
import type { RowDataPacket } from "mysql2/promise";
import { MySQLService } from "../database/mysql.service";
import type {
  PrincipalAttendanceEngagementHeatmapBlockDto,
  PrincipalAttEngContributorClassDto,
  PrincipalAttEngContributorStudentDto,
  PrincipalAttEngContributorsResponseDto,
  PrincipalAttEngDayBucketDto,
  PrincipalAttEngSnapshotDto,
  PrincipalAttEngSnapshotPointDto,
  PrincipalAttEngWeekBucketDto,
} from "./dto/principal-attendance-engagement-heatmap.dto";

type AttDayRow = RowDataPacket & { d: string | Date; present_like: number | string | null; total: number | string | null };
type LmsDayRow = RowDataPacket & {
  d: string | Date;
  engagement_event_count: number | string | null;
  eng_score_n: number | string | null;
  eng_score_sum: number | string | null;
};
type SnapRow = RowDataPacket & {
  weekStart: string | Date;
  attendance: number | string | null;
  engagement: number | string | null;
};

type ContributorStudentRow = RowDataPacket & { id: number | string; displayName: string | null };
type ContributorClassRow = RowDataPacket & { id: number | string; name: string | null };

/** In-memory row: DTO fields plus score row-count for correct weekly engagement weighting. */
type DayInternal = PrincipalAttEngDayBucketDto & { engagementScoreNonNull: number };

function parseYmd(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class PrincipalAttendanceEngagementHeatmapService {
  constructor(private readonly db: MySQLService) {}

  /** UTC calendar date `YYYY-MM-DD` (same idea as lms-heatmaps `toUtcYmd`). */
  private toUtcYmd(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  /** Monday UTC of the ISO week containing `d` (aligned with lms-heatmaps `weekStartKey`). */
  private weekStartMondayUtc(d: Date): string {
    const x = new Date(d);
    const day = x.getUTCDay();
    const diff = (day + 6) % 7;
    x.setUTCDate(x.getUTCDate() - diff);
    x.setUTCHours(0, 0, 0, 0);
    return this.toUtcYmd(x);
  }

  /** Present-like statuses aligned with `AnalyticsService` PRESENT_LIKE. */
  private presentLikeSqlPredicate(alias: string): string {
    return `LOWER(TRIM(${alias}.status)) IN ('present', 'late', 'excused')`;
  }

  private eachUtcDayInclusive(fromStr: string, toStr: string): string[] {
    const from = parseYmd(fromStr);
    const to = parseYmd(toStr);
    if (!from || !to) return [];
    let a = from.getTime();
    let b = to.getTime();
    if (a > b) {
      const t = a;
      a = b;
      b = t;
    }
    const out: string[] = [];
    for (let t = a; t <= b; t += 86400000) {
      out.push(this.toUtcYmd(new Date(t)));
    }
    return out;
  }

  private ymdFromRow(v: string | Date): string {
    if (v instanceof Date) return this.toUtcYmd(v);
    const s = String(v);
    return s.length >= 10 ? s.slice(0, 10) : s;
  }

  /**
   * Live school-level attendance + LMS engagement buckets for the principal heatmap.
   * Read-only. Does not apply teacher scope (principal school-wide view).
   */
  async buildSchoolSeries(
    schoolId: string,
    fromStr: string,
    toStr: string,
  ): Promise<PrincipalAttendanceEngagementHeatmapBlockDto> {
    const from = parseYmd(fromStr);
    const to = parseYmd(toStr);
    if (!from || !to) {
      return this.emptyBlock(fromStr, toStr);
    }
    const fromNorm = this.toUtcYmd(from.getTime() <= to.getTime() ? from : to);
    const toNorm = this.toUtcYmd(from.getTime() <= to.getTime() ? to : from);

    const pl = this.presentLikeSqlPredicate("ar");

    const [attPacket, lmsPacket, snapPacket] = await Promise.all([
      this.db.query(
        `
        SELECT DATE_FORMAT(ar.session_date, '%Y-%m-%d') AS d,
               SUM(CASE WHEN ${pl} THEN 1 ELSE 0 END) AS present_like,
               COUNT(*) AS total
        FROM attendance_records ar
        WHERE ar.school_id = ?
          AND ar.deleted_at IS NULL
          AND ar.session_date >= ?
          AND ar.session_date <= ?
        GROUP BY DATE_FORMAT(ar.session_date, '%Y-%m-%d')
        `,
        [schoolId, fromNorm, toNorm],
      ),
      this.db.query(
        `
        SELECT DATE(e.occurred_at) AS d,
               COUNT(*) AS engagement_event_count,
               SUM(CASE WHEN e.engagement_score IS NOT NULL THEN 1 ELSE 0 END) AS eng_score_n,
               SUM(e.engagement_score) AS eng_score_sum
        FROM lms_activity_events e
        WHERE e.school_id = ?
          AND e.deleted_at IS NULL
          AND e.status = 'active'
          AND DATE(e.occurred_at) >= ?
          AND DATE(e.occurred_at) <= ?
        GROUP BY DATE(e.occurred_at)
        `,
        [schoolId, fromNorm, toNorm],
      ),
      this.db.query(
        `
        SELECT DATE_FORMAT(w.\`weekStartDate\`, '%Y-%m-%d') AS weekStart,
               w.attendance AS attendance,
               w.engagement AS engagement
        FROM weekly_school_snapshots w
        WHERE w.\`schoolId\` = ?
          AND w.\`weekStartDate\` >= ?
          AND w.\`weekStartDate\` <= ?
        ORDER BY w.\`weekStartDate\` ASC
        `,
        [schoolId, fromNorm, toNorm],
      ),
    ]);

    const attRows = attPacket[0] as AttDayRow[];
    const lmsRows = lmsPacket[0] as LmsDayRow[];
    const snapRows = snapPacket[0] as SnapRow[];

    const attByDay = new Map<string, { presentLike: number; total: number }>();
    for (const r of attRows) {
      const d = this.ymdFromRow(r.d);
      attByDay.set(d, { presentLike: num(r.present_like), total: num(r.total) });
    }
    const lmsByDay = new Map<string, { evt: number; scoreN: number; scoreSum: number }>();
    for (const r of lmsRows) {
      const d = this.ymdFromRow(r.d);
      lmsByDay.set(d, {
        evt: num(r.engagement_event_count),
        scoreN: num(r.eng_score_n),
        scoreSum: num(r.eng_score_sum),
      });
    }

    const days = this.eachUtcDayInclusive(fromNorm, toNorm);
    const dailyInternal: DayInternal[] = days.map((date) => {
      const a = attByDay.get(date) ?? { presentLike: 0, total: 0 };
      const l = lmsByDay.get(date) ?? { evt: 0, scoreN: 0, scoreSum: 0 };
      const attendanceRate = a.total > 0 ? a.presentLike / a.total : null;
      const engagementAvg = l.scoreN > 0 ? l.scoreSum / l.scoreN : null;
      return {
        date,
        attendanceRate,
        attendanceSessions: a.total,
        engagementAvg,
        engagementEventCount: l.evt,
        engagementScoreNonNull: l.scoreN,
      };
    });

    const daily: PrincipalAttEngDayBucketDto[] = dailyInternal.map((row) => ({
      date: row.date,
      attendanceRate: row.attendanceRate,
      attendanceSessions: row.attendanceSessions,
      engagementAvg: row.engagementAvg,
      engagementEventCount: row.engagementEventCount,
    }));

    const weekly = this.buildWeeklyBuckets(dailyInternal);
    const snapshot = this.buildSnapshotBlock(snapRows);

    return {
      window: { from: fromNorm, to: toNorm },
      daily,
      weekly,
      snapshot,
    };
  }

  private buildWeeklyBuckets(daily: DayInternal[]): PrincipalAttEngWeekBucketDto[] {
    type Acc = {
      presentLike: number;
      totalSessions: number;
      engScoreSum: number;
      engScoreN: number;
    };
    const byWeek = new Map<string, Acc>();
    const evtByWeek = new Map<string, number>();

    for (const day of daily) {
      const ws = this.weekStartMondayUtc(new Date(`${day.date}T12:00:00.000Z`));
      let acc = byWeek.get(ws);
      if (!acc) {
        acc = { presentLike: 0, totalSessions: 0, engScoreSum: 0, engScoreN: 0 };
        byWeek.set(ws, acc);
      }
      if (day.attendanceRate != null && day.attendanceSessions > 0) {
        acc.presentLike += day.attendanceRate * day.attendanceSessions;
      }
      acc.totalSessions += day.attendanceSessions;

      if (day.engagementAvg != null && day.engagementScoreNonNull > 0) {
        acc.engScoreSum += day.engagementAvg * day.engagementScoreNonNull;
        acc.engScoreN += day.engagementScoreNonNull;
      }
      evtByWeek.set(ws, (evtByWeek.get(ws) ?? 0) + day.engagementEventCount);
    }

    return [...byWeek.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, acc]) => ({
        weekStart,
        attendanceRate: acc.totalSessions > 0 ? acc.presentLike / acc.totalSessions : null,
        attendanceSessions: acc.totalSessions,
        engagementAvg: acc.engScoreN > 0 ? acc.engScoreSum / acc.engScoreN : null,
        engagementEventCount: evtByWeek.get(weekStart) ?? 0,
      }));
  }

  private buildSnapshotBlock(snapRows: SnapRow[]): PrincipalAttEngSnapshotDto {
    if (!snapRows.length) {
      return {
        available: false,
        message: "No snapshot data available.",
        points: [],
      };
    }
    const points: PrincipalAttEngSnapshotPointDto[] = snapRows.map((r) => ({
      weekStart: this.ymdFromRow(r.weekStart),
      attendance: r.attendance != null ? num(r.attendance) : null,
      engagement: r.engagement != null ? num(r.engagement) : null,
    }));
    return {
      available: true,
      message: null,
      points,
    };
  }

  private emptyBlock(fromStr: string, toStr: string): PrincipalAttendanceEngagementHeatmapBlockDto {
    return {
      window: { from: fromStr, to: toStr },
      daily: [],
      weekly: [],
      snapshot: {
        available: false,
        message: "No snapshot data available.",
        points: [],
      },
    };
  }

  private attendanceDateFilter(
    bucketType: "day" | "week",
    bucketKey: string,
  ): { sql: string; params: string[] } {
    if (bucketType === "day") {
      return { sql: "ar.session_date = ?", params: [bucketKey] };
    }
    return {
      sql: "ar.session_date >= ? AND ar.session_date < DATE_ADD(?, INTERVAL 7 DAY)",
      params: [bucketKey, bucketKey],
    };
  }

  private engagementDateFilter(
    bucketType: "day" | "week",
    bucketKey: string,
  ): { sql: string; params: string[] } {
    if (bucketType === "day") {
      return { sql: "DATE(e.occurred_at) = ?", params: [bucketKey] };
    }
    return {
      sql: "DATE(e.occurred_at) >= ? AND DATE(e.occurred_at) < DATE_ADD(?, INTERVAL 7 DAY)",
      params: [bucketKey, bucketKey],
    };
  }

  /**
   * Distinct students and classes contributing to a heatmap bucket (read-only).
   */
  async getContributors(
    schoolId: string,
    bucketType: "day" | "week",
    bucketKey: string,
    metric: "attendance" | "engagement",
    limit: number,
  ): Promise<PrincipalAttEngContributorsResponseDto> {
    const cap = Math.min(100, Math.max(1, Math.trunc(limit)));
    if (!parseYmd(bucketKey)) {
      throw new BadRequestException("Invalid bucketKey");
    }
    if (bucketType === "week") {
      const mon = this.weekStartMondayUtc(new Date(`${bucketKey}T12:00:00.000Z`));
      if (mon !== bucketKey) {
        throw new BadRequestException(
          "bucketKey must be the UTC Monday (ISO week start) when bucketType is week",
        );
      }
    }

    if (metric === "attendance") {
      const [students, classes] = await Promise.all([
        this.queryAttendanceContributorStudents(schoolId, bucketType, bucketKey, cap),
        this.queryAttendanceContributorClasses(schoolId, bucketType, bucketKey, cap),
      ]);
      return { metric, bucketType, bucketKey, students, classes };
    }
    const [students, classes] = await Promise.all([
      this.queryEngagementContributorStudents(schoolId, bucketType, bucketKey, cap),
      this.queryEngagementContributorClasses(schoolId, bucketType, bucketKey, cap),
    ]);
    return { metric, bucketType, bucketKey, students, classes };
  }

  private async queryAttendanceContributorStudents(
    schoolId: string,
    bucketType: "day" | "week",
    bucketKey: string,
    cap: number,
  ): Promise<PrincipalAttEngContributorStudentDto[]> {
    const f = this.attendanceDateFilter(bucketType, bucketKey);
    const sql = `
      SELECT DISTINCT s.id AS id,
        COALESCE(
          NULLIF(TRIM(s.display_name), ''),
          NULLIF(TRIM(CONCAT(COALESCE(s.given_name, ''), ' ', COALESCE(s.family_name, ''))), ''),
          CAST(s.id AS CHAR)
        ) AS displayName
      FROM attendance_records ar
      INNER JOIN students s
        ON s.id = ar.student_id AND s.deleted_at IS NULL AND s.school_id = ar.school_id
      WHERE ar.school_id = ?
        AND ar.deleted_at IS NULL
        AND ${f.sql}
      ORDER BY displayName ASC
      LIMIT ?
    `;
    const [rows] = await this.db.query(sql, [schoolId, ...f.params, cap]);
    return (rows as ContributorStudentRow[]).map((r) => ({
      id: String(r.id),
      displayName: r.displayName != null ? String(r.displayName) : null,
    }));
  }

  private async queryAttendanceContributorClasses(
    schoolId: string,
    bucketType: "day" | "week",
    bucketKey: string,
    cap: number,
  ): Promise<PrincipalAttEngContributorClassDto[]> {
    const f = this.attendanceDateFilter(bucketType, bucketKey);
    const sql = `
      SELECT DISTINCT c.id AS id, c.name AS name
      FROM attendance_records ar
      INNER JOIN classes c
        ON c.id = ar.class_id AND c.deleted_at IS NULL AND c.school_id = ar.school_id
      WHERE ar.school_id = ?
        AND ar.deleted_at IS NULL
        AND ${f.sql}
      ORDER BY c.name ASC
      LIMIT ?
    `;
    const [rows] = await this.db.query(sql, [schoolId, ...f.params, cap]);
    return (rows as ContributorClassRow[]).map((r) => ({
      id: String(r.id),
      name: String(r.name ?? ""),
    }));
  }

  private async queryEngagementContributorStudents(
    schoolId: string,
    bucketType: "day" | "week",
    bucketKey: string,
    cap: number,
  ): Promise<PrincipalAttEngContributorStudentDto[]> {
    const f = this.engagementDateFilter(bucketType, bucketKey);
    const sql = `
      SELECT DISTINCT s.id AS id,
        COALESCE(
          NULLIF(TRIM(s.display_name), ''),
          NULLIF(TRIM(CONCAT(COALESCE(s.given_name, ''), ' ', COALESCE(s.family_name, ''))), ''),
          CAST(s.id AS CHAR)
        ) AS displayName
      FROM lms_activity_events e
      INNER JOIN students s
        ON s.id = e.student_id AND s.deleted_at IS NULL AND s.school_id = e.school_id
      WHERE e.school_id = ?
        AND e.deleted_at IS NULL
        AND e.status = 'active'
        AND ${f.sql}
      ORDER BY displayName ASC
      LIMIT ?
    `;
    const [rows] = await this.db.query(sql, [schoolId, ...f.params, cap]);
    return (rows as ContributorStudentRow[]).map((r) => ({
      id: String(r.id),
      displayName: r.displayName != null ? String(r.displayName) : null,
    }));
  }

  private async queryEngagementContributorClasses(
    schoolId: string,
    bucketType: "day" | "week",
    bucketKey: string,
    cap: number,
  ): Promise<PrincipalAttEngContributorClassDto[]> {
    const f = this.engagementDateFilter(bucketType, bucketKey);
    const sql = `
      SELECT DISTINCT c.id AS id, c.name AS name
      FROM lms_activity_events e
      INNER JOIN classes c
        ON c.id = e.class_id AND c.deleted_at IS NULL AND c.school_id = e.school_id
      WHERE e.school_id = ?
        AND e.deleted_at IS NULL
        AND e.status = 'active'
        AND e.class_id IS NOT NULL
        AND ${f.sql}
      ORDER BY c.name ASC
      LIMIT ?
    `;
    const [rows] = await this.db.query(sql, [schoolId, ...f.params, cap]);
    return (rows as ContributorClassRow[]).map((r) => ({
      id: String(r.id),
      name: String(r.name ?? ""),
    }));
  }
}
