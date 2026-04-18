import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2/promise";
import { AnalyticsService } from "../analytics/analytics.service";
import { UserRole } from "../common/user-role";
import type { JwtPayload } from "../common/types/jwt-payload";
import { MySQLService } from "../database/mysql.service";
import { RiskService } from "../risk/risk.service";
import { RiskLevel } from "../risk/dto/risk-level.enum";
import type { RiskInput } from "../risk/risk-engine.types";
import { computeSnapshotStability } from "../weekly-reports/snapshot-stability.util";

type IdRow = RowDataPacket & { id: string };

type EnrollStudentRow = RowDataPacket & {
  studentId: string;
  classId: string;
  student_pk: string;
  studentClassId: string | null;
  performance: number | null;
  attendance: number | null;
  engagement: number | null;
  riskScore: number | null;
  deltas: unknown;
  tiers: unknown;
  flags: unknown;
  stability: number | null;
};

type WeeklyStudentSnapRow = RowDataPacket & {
  id: string;
  performance: number | null;
  attendance: number | null;
  engagement: number | null;
  riskScore: number | null;
  riskTier: string | null;
  riskComposite: number | null;
  riskCategory: string | null;
  riskReasons: unknown;
  riskStability: number | null;
  riskDeltas: unknown;
};

type WeeklySnapIdRow = RowDataPacket & { id: string };

function jsonOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  return JSON.stringify(v);
}

function mondayUtcContaining(d: Date): Date {
  const x = new Date(d);
  const day = x.getUTCDay();
  const diff = (day + 6) % 7;
  x.setUTCDate(x.getUTCDate() - diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function meanTimeline(points: { value: number }[]): number {
  const vals = points.filter((p) => Number.isFinite(p.value)).map((p) => p.value);
  if (!vals.length) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
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

function classifyTier(value: number): number {
  if (value >= 80) return 1;
  if (value >= 50) return 2;
  return 3;
}

@Injectable()
export class SnapshotsService {
  constructor(
    private readonly db: MySQLService,
    private readonly analytics: AnalyticsService,
    private readonly risk: RiskService,
  ) {}

  private principalScope(schoolId: string): JwtPayload {
    return {
      sub: "snapshot-cron",
      email: "snapshot-cron@local",
      schoolId,
      role: UserRole.PRINCIPAL,
      teacherId: null,
    };
  }

  private async fetchSchoolIds(): Promise<string[]> {
    const sql = `SELECT id FROM schools WHERE deleted_at IS NULL`;
    const packet = (await this.db.query(sql))[0] as IdRow[];
    const rows = packet as IdRow[];
    return rows.map((r) => r.id);
  }

  private async fetchEnrollmentsWithStudents(schoolId: string): Promise<EnrollStudentRow[]> {
    const sql = `
      SELECT e.student_id AS studentId,
             e.class_id AS classId,
             s.id AS student_pk,
             s.class_id AS studentClassId,
             s.performance,
             s.attendance,
             s.engagement,
             s.risk_score AS riskScore,
             s.deltas,
             s.tiers,
             s.flags,
             s.stability
      FROM enrollments e
      INNER JOIN students s ON s.id = e.student_id AND s.deleted_at IS NULL
      WHERE e.school_id = ?
        AND e.status = 'active'
        AND e.deleted_at IS NULL
      ORDER BY e.student_id
    `;
    const packet = (await this.db.query(sql, [schoolId]))[0] as EnrollStudentRow[];
    return packet as EnrollStudentRow[];
  }

  private async findWeeklyStudentSnapshot(
    schoolId: string,
    studentId: string,
    weekStart: Date,
  ): Promise<WeeklyStudentSnapRow | null> {
    const sql = `
      SELECT id,
             performance,
             attendance,
             engagement,
             \`riskScore\`,
             \`riskTier\`,
             \`riskComposite\`,
             \`riskCategory\`,
             \`riskReasons\`,
             \`riskStability\`,
             \`riskDeltas\`
      FROM weekly_student_snapshots
      WHERE \`schoolId\` = ? AND \`studentId\` = ? AND \`weekStartDate\` = ?
      LIMIT 1
    `;
    const packet = (await this.db.query(sql, [schoolId, studentId, weekStart]))[0] as WeeklyStudentSnapRow[];
    const rows = packet as WeeklyStudentSnapRow[];
    return rows[0] ?? null;
  }

  private async findWeeklyStudentSnapshotId(
    schoolId: string,
    studentId: string,
    weekStart: Date,
  ): Promise<string | null> {
    const sql = `
      SELECT id FROM weekly_student_snapshots
      WHERE \`schoolId\` = ? AND \`studentId\` = ? AND \`weekStartDate\` = ?
      LIMIT 1
    `;
    const packet = (await this.db.query(sql, [schoolId, studentId, weekStart]))[0] as WeeklySnapIdRow[];
    const rows = packet as WeeklySnapIdRow[];
    return rows[0]?.id ?? null;
  }

  private async upsertWeeklyStudentSnapshot(
    schoolId: string,
    studentId: string,
    weekStart: Date,
    payload: {
      performance: number;
      attendance: number;
      engagement: number;
      riskScore: number;
      riskTier: string;
      riskComposite: number;
      riskCategory: string;
      riskReasons: unknown;
      riskStability: number;
      riskDeltas: unknown;
    },
  ): Promise<void> {
    const existingId = await this.findWeeklyStudentSnapshotId(schoolId, studentId, weekStart);
    const reasonsJson = jsonOrNull(payload.riskReasons);
    const deltasJson = jsonOrNull(payload.riskDeltas);
    if (existingId) {
      const upd = `
        UPDATE weekly_student_snapshots SET
          performance = ?,
          attendance = ?,
          engagement = ?,
          \`riskScore\` = ?,
          \`riskTier\` = ?,
          \`riskComposite\` = ?,
          \`riskCategory\` = ?,
          \`riskReasons\` = CAST(? AS JSON),
          \`riskStability\` = ?,
          \`riskDeltas\` = CAST(? AS JSON)
        WHERE id = ?
      `;
      await this.db.query(upd, [
        payload.performance,
        payload.attendance,
        payload.engagement,
        payload.riskScore,
        payload.riskTier,
        payload.riskComposite,
        payload.riskCategory,
        reasonsJson,
        payload.riskStability,
        deltasJson,
        existingId,
      ]);
      return;
    }
    const id = randomUUID();
    const ins = `
      INSERT INTO weekly_student_snapshots (
        id, \`schoolId\`, \`studentId\`, \`weekStartDate\`,
        performance, attendance, engagement, \`riskScore\`, \`riskTier\`,
        \`riskComposite\`, \`riskCategory\`, \`riskReasons\`, \`riskStability\`, \`riskDeltas\`,
        \`createdAt\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, CAST(? AS JSON), NOW(3))
    `;
    await this.db.query(ins, [
      id,
      schoolId,
      studentId,
      weekStart,
      payload.performance,
      payload.attendance,
      payload.engagement,
      payload.riskScore,
      payload.riskTier,
      payload.riskComposite,
      payload.riskCategory,
      reasonsJson,
      payload.riskStability,
      deltasJson,
    ]);
  }

  private async fetchClassIdsForSchool(schoolId: string): Promise<string[]> {
    const sql = `SELECT id FROM classes WHERE school_id = ? AND deleted_at IS NULL`;
    const packet = (await this.db.query(sql, [schoolId]))[0] as IdRow[];
    return (packet as IdRow[]).map((r) => r.id);
  }

  private async findWeeklyClassSnapshotId(
    schoolId: string,
    classId: string,
    weekStart: Date,
  ): Promise<string | null> {
    const sql = `
      SELECT id FROM weekly_class_snapshots
      WHERE \`schoolId\` = ? AND \`classId\` = ? AND \`weekStartDate\` = ?
      LIMIT 1
    `;
    const packet = (await this.db.query(sql, [schoolId, classId, weekStart]))[0] as WeeklySnapIdRow[];
    const rows = packet as WeeklySnapIdRow[];
    return rows[0]?.id ?? null;
  }

  private async findWeeklyClassSnapshotForLastWeek(
    schoolId: string,
    classId: string,
    lastWeekStart: Date,
  ): Promise<{
    performance: number | null;
    attendance: number | null;
    engagement: number | null;
    riskScore: number | null;
  } | null> {
    const sql = `
      SELECT performance, attendance, engagement, \`riskScore\`
      FROM weekly_class_snapshots
      WHERE \`schoolId\` = ? AND \`classId\` = ? AND \`weekStartDate\` = ?
      LIMIT 1
    `;
    const packet = (await this.db.query(sql, [schoolId, classId, lastWeekStart]))[0] as RowDataPacket[];
    const rows = packet as RowDataPacket[];
    const r = rows[0];
    if (!r) return null;
    return {
      performance: r.performance != null ? Number(r.performance) : null,
      attendance: r.attendance != null ? Number(r.attendance) : null,
      engagement: r.engagement != null ? Number(r.engagement) : null,
      riskScore: r.riskScore != null ? Number(r.riskScore) : null,
    };
  }

  private async upsertWeeklyClassSnapshot(
    schoolId: string,
    classId: string,
    weekStart: Date,
    payload: {
      performance: number;
      attendance: number;
      engagement: number;
      riskScore: number;
      riskComposite: number | null;
      riskCategory: string | null;
      riskReasons: unknown;
      riskStability: number | null;
      riskDeltas: unknown;
    },
  ): Promise<void> {
    const existingId = await this.findWeeklyClassSnapshotId(schoolId, classId, weekStart);
    const reasonsJson = jsonOrNull(payload.riskReasons);
    const deltasJson = jsonOrNull(payload.riskDeltas);
    if (existingId) {
      const upd = `
        UPDATE weekly_class_snapshots SET
          performance = ?,
          attendance = ?,
          engagement = ?,
          \`riskScore\` = ?,
          \`riskComposite\` = ?,
          \`riskCategory\` = ?,
          \`riskReasons\` = CAST(? AS JSON),
          \`riskStability\` = ?,
          \`riskDeltas\` = CAST(? AS JSON)
        WHERE id = ?
      `;
      await this.db.query(upd, [
        payload.performance,
        payload.attendance,
        payload.engagement,
        payload.riskScore,
        payload.riskComposite,
        payload.riskCategory,
        reasonsJson,
        payload.riskStability,
        deltasJson,
        existingId,
      ]);
      return;
    }
    const id = randomUUID();
    const ins = `
      INSERT INTO weekly_class_snapshots (
        id, \`schoolId\`, \`classId\`, \`weekStartDate\`,
        performance, attendance, engagement, \`riskScore\`,
        \`riskComposite\`, \`riskCategory\`, \`riskReasons\`, \`riskStability\`, \`riskDeltas\`,
        \`createdAt\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, CAST(? AS JSON), NOW(3))
    `;
    await this.db.query(ins, [
      id,
      schoolId,
      classId,
      weekStart,
      payload.performance,
      payload.attendance,
      payload.engagement,
      payload.riskScore,
      payload.riskComposite,
      payload.riskCategory,
      reasonsJson,
      payload.riskStability,
      deltasJson,
    ]);
  }

  private async fetchStudentSnapsForSchoolWeek(
    schoolId: string,
    weekStart: Date,
  ): Promise<WeeklyStudentSnapRow[]> {
    const sql = `
      SELECT id,
             performance,
             attendance,
             engagement,
             \`riskScore\`,
             \`riskTier\`,
             \`riskComposite\`,
             \`riskCategory\`,
             \`riskReasons\`,
             \`riskStability\`,
             \`riskDeltas\`
      FROM weekly_student_snapshots
      WHERE \`schoolId\` = ? AND \`weekStartDate\` = ?
    `;
    const packet = (await this.db.query(sql, [schoolId, weekStart]))[0] as WeeklyStudentSnapRow[];
    return packet as WeeklyStudentSnapRow[];
  }

  private async findWeeklySchoolSnapshotId(schoolId: string, weekStart: Date): Promise<string | null> {
    const sql = `
      SELECT id FROM weekly_school_snapshots
      WHERE \`schoolId\` = ? AND \`weekStartDate\` = ?
      LIMIT 1
    `;
    const packet = (await this.db.query(sql, [schoolId, weekStart]))[0] as WeeklySnapIdRow[];
    const rows = packet as WeeklySnapIdRow[];
    return rows[0]?.id ?? null;
  }

  private async upsertWeeklySchoolSnapshot(
    schoolId: string,
    weekStart: Date,
    schoolPayload: {
      performance: number | null;
      attendance: number | null;
      engagement: number | null;
      riskLow: number;
      riskMedium: number;
      riskHigh: number;
      riskAverage: number | null;
      riskComposite: number | null;
      riskCategory: string;
      riskReasons: unknown;
      riskStability: number | undefined;
      riskDeltas: undefined;
    },
  ): Promise<void> {
    const existingId = await this.findWeeklySchoolSnapshotId(schoolId, weekStart);
    const reasonsJson = jsonOrNull(schoolPayload.riskReasons);
    const stabilityVal = schoolPayload.riskStability ?? null;
    if (existingId) {
      const upd = `
        UPDATE weekly_school_snapshots SET
          performance = ?,
          attendance = ?,
          engagement = ?,
          \`riskLow\` = ?,
          \`riskMedium\` = ?,
          \`riskHigh\` = ?,
          \`riskAverage\` = ?,
          \`riskComposite\` = ?,
          \`riskCategory\` = ?,
          \`riskReasons\` = CAST(? AS JSON),
          \`riskStability\` = ?,
          \`riskDeltas\` = NULL
        WHERE id = ?
      `;
      await this.db.query(upd, [
        schoolPayload.performance,
        schoolPayload.attendance,
        schoolPayload.engagement,
        schoolPayload.riskLow,
        schoolPayload.riskMedium,
        schoolPayload.riskHigh,
        schoolPayload.riskAverage,
        schoolPayload.riskComposite,
        schoolPayload.riskCategory,
        reasonsJson,
        stabilityVal,
        existingId,
      ]);
      return;
    }
    const id = randomUUID();
    const ins = `
      INSERT INTO weekly_school_snapshots (
        id, \`schoolId\`, \`weekStartDate\`,
        performance, attendance, engagement,
        \`riskLow\`, \`riskMedium\`, \`riskHigh\`, \`riskAverage\`,
        \`interventionsCreated\`, \`interventionsResolved\`,
        \`riskComposite\`, \`riskCategory\`, \`riskReasons\`, \`riskStability\`, \`riskDeltas\`,
        \`createdAt\`
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, CAST(? AS JSON), ?, NULL, NOW(3)
      )
    `;
    await this.db.query(ins, [
      id,
      schoolId,
      weekStart,
      schoolPayload.performance,
      schoolPayload.attendance,
      schoolPayload.engagement,
      schoolPayload.riskLow,
      schoolPayload.riskMedium,
      schoolPayload.riskHigh,
      schoolPayload.riskAverage,
      schoolPayload.riskComposite,
      schoolPayload.riskCategory,
      reasonsJson,
      stabilityVal,
    ]);
  }

  async runWeeklySnapshot(): Promise<void> {
    const weekStart = mondayUtcContaining(new Date());
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);

    const schoolIds = await this.fetchSchoolIds();

    for (const schoolId of schoolIds) {
      const scoped = this.principalScope(schoolId);

      const enrollRows = await this.fetchEnrollmentsWithStudents(schoolId);

      const studentIdToClassId = new Map<string, string>();
      type StudentRowShape = {
        id: string;
        classId: string | null;
        performance: number | null;
        attendance: number | null;
        engagement: number | null;
        riskScore: number | null;
        deltas: unknown;
        tiers: unknown;
        flags: unknown;
        stability: number | null;
      };
      const studentRowById = new Map<string, StudentRowShape>();
      for (const e of enrollRows) {
        if (!studentIdToClassId.has(e.studentId)) {
          studentIdToClassId.set(e.studentId, e.classId);
          studentRowById.set(e.studentId, {
            id: e.student_pk,
            classId: e.studentClassId,
            performance: e.performance != null ? Number(e.performance) : null,
            attendance: e.attendance != null ? Number(e.attendance) : null,
            engagement: e.engagement != null ? Number(e.engagement) : null,
            riskScore: e.riskScore != null ? Number(e.riskScore) : null,
            deltas: e.deltas,
            tiers: e.tiers,
            flags: e.flags,
            stability: e.stability != null ? Number(e.stability) : null,
          });
        }
      }

      const riskInputsByClass = new Map<string, RiskInput[]>();

      for (const studentId of studentIdToClassId.keys()) {
        const classId = studentIdToClassId.get(studentId)!;
        const student = studentRowById.get(studentId)!;

        const a = await this.analytics.getStudentAnalytics(studentId, scoped);
        const r = await this.risk.getStudentRisk(schoolId, studentId, scoped);

        const perf = Math.round(meanTimeline(a.scoreTimeline ?? []) * 10) / 10;
        const att = Math.round(meanTimeline(a.attendanceTimeline ?? []) * 1000) / 1000;
        const eng = a.engagementScore ?? 0;
        const riskScore = r.overall;

        const lastSnap = await this.findWeeklyStudentSnapshot(schoolId, studentId, lastWeekStart);

        const perfDelta = lastSnap?.performance != null ? perf - (Number(lastSnap.performance) ?? 0) : 0;
        const attDelta = lastSnap?.attendance != null ? att - (Number(lastSnap.attendance) ?? 0) : 0;
        const engDelta = lastSnap?.engagement != null ? eng - (Number(lastSnap.engagement) ?? 0) : 0;
        const riskDelta =
          lastSnap?.riskScore != null ? riskScore - (Number(lastSnap.riskScore) ?? 0) : 0;

        const deltas = {
          performance: perfDelta,
          attendance: attDelta,
          engagement: engDelta,
          risk: riskDelta,
        };

        const stThisLike = {
          performance: perf,
          attendance: att,
          engagement: eng,
          riskScore,
        };
        const stLastLike = lastSnap
          ? {
              performance: lastSnap.performance != null ? Number(lastSnap.performance) : null,
              attendance: lastSnap.attendance != null ? Number(lastSnap.attendance) : null,
              engagement: lastSnap.engagement != null ? Number(lastSnap.engagement) : null,
              riskScore: lastSnap.riskScore != null ? Number(lastSnap.riskScore) : null,
            }
          : null;

        const stability = computeSnapshotStability(stThisLike as never, stLastLike as never);

        const tiers = {
          performance: classifyTier(perf),
          attendance: classifyTier(att * 100),
          engagement: classifyTier(eng),
          risk: classifyTier(100 - riskScore),
        };

        const riskInput: RiskInput = {
          studentId: student.id,
          classId: student.classId ?? classId,
          performance: student.performance ?? perf,
          attendance: student.attendance ?? att,
          engagement: student.engagement ?? eng,
          riskScore: student.riskScore ?? riskScore,
          deltas: (student.deltas as RiskInput["deltas"]) ?? deltas,
          tiers: (student.tiers as RiskInput["tiers"]) ?? tiers,
          flags:
            (student.flags as RiskInput["flags"]) ?? {
              lowPerformance: false,
              lowAttendance: false,
              lowEngagement: false,
              highRisk: false,
            },
          stability: student.stability ?? stability,
        };

        const engineRisk = this.risk.getStudentRiskEngine(riskInput);

        const payload = {
          performance: perf,
          attendance: att,
          engagement: eng,
          riskScore,
          riskTier: riskTierLabel(r.level),
          riskComposite: engineRisk.compositeRisk,
          riskCategory: engineRisk.category,
          riskReasons: engineRisk.reasons,
          riskStability: engineRisk.stability,
          riskDeltas: engineRisk.deltas,
        };

        await this.upsertWeeklyStudentSnapshot(schoolId, studentId, weekStart, payload);

        if (!riskInputsByClass.has(classId)) riskInputsByClass.set(classId, []);
        riskInputsByClass.get(classId)!.push(riskInput);
      }

      const classIds = await this.fetchClassIdsForSchool(schoolId);

      for (const classId of classIds) {
        const inputs = riskInputsByClass.get(classId) ?? [];
        const engineClass = inputs.length ? this.risk.getClassRiskEngine(inputs) : null;

        const classA = await this.analytics.getClassAnalytics(classId, scoped);
        const perf = classA.averageScore ?? 0;
        const att = classA.attendanceRate ?? 0;
        const eng = classA.engagementScore ?? 0;
        const classR = await this.risk.getClassRisk(schoolId, classId, scoped);

        const lastClass = await this.findWeeklyClassSnapshotForLastWeek(schoolId, classId, lastWeekStart);

        const classPayload = {
          performance: perf,
          attendance: att,
          engagement: eng,
          riskScore: classR.overall,
          riskComposite: engineClass?.classRisk ?? null,
          riskCategory: engineClass
            ? engineClass.distribution.high > 0
              ? "high"
              : engineClass.distribution.medium >= engineClass.distribution.low
                ? "medium"
                : "low"
            : null,
          riskReasons: [] as unknown,
          riskStability: engineClass
            ? inputs.reduce((s, i) => s + i.stability, 0) / Math.max(1, inputs.length)
            : null,
          riskDeltas: engineClass
            ? {
                performance: lastClass?.performance != null ? perf - (lastClass.performance ?? 0) : 0,
                attendance: lastClass?.attendance != null ? att - (lastClass.attendance ?? 0) : 0,
                engagement: lastClass?.engagement != null ? eng - (lastClass.engagement ?? 0) : 0,
                risk: lastClass?.riskScore != null ? classR.overall - (lastClass.riskScore ?? 0) : 0,
              }
            : null,
        };

        await this.upsertWeeklyClassSnapshot(schoolId, classId, weekStart, classPayload);
      }

      const studentSnaps = await this.fetchStudentSnapsForSchoolWeek(schoolId, weekStart);

      const avg = (xs: (number | null | undefined)[]) => {
        const vals = xs.filter((x): x is number => x != null && Number.isFinite(x));
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      };

      const schoolPayload = {
        performance: avg(studentSnaps.map((s) => (s.performance != null ? Number(s.performance) : null))),
        attendance: avg(studentSnaps.map((s) => (s.attendance != null ? Number(s.attendance) : null))),
        engagement: avg(studentSnaps.map((s) => (s.engagement != null ? Number(s.engagement) : null))),
        riskLow: studentSnaps.filter((s) => (s.riskTier ?? "").toUpperCase() === "LOW").length,
        riskMedium: studentSnaps.filter((s) => (s.riskTier ?? "").toUpperCase() === "MEDIUM").length,
        riskHigh: studentSnaps.filter((s) => (s.riskTier ?? "").toUpperCase() === "HIGH").length,
        riskAverage: avg(studentSnaps.map((s) => (s.riskScore != null ? Number(s.riskScore) : null))),
        riskComposite: avg(studentSnaps.map((s) => (s.riskComposite != null ? Number(s.riskComposite) : null))),
        riskCategory:
          studentSnaps.filter((s) => (s.riskCategory ?? "") === "high").length > studentSnaps.length / 2
            ? "high"
            : studentSnaps.filter((s) => (s.riskCategory ?? "") === "medium").length > 0
              ? "medium"
              : "low",
        riskReasons: [] as unknown,
        riskStability: avg(studentSnaps.map((s) => (s.riskStability != null ? Number(s.riskStability) : null))) ?? undefined,
        riskDeltas: undefined as undefined,
      };

      await this.upsertWeeklySchoolSnapshot(schoolId, weekStart, schoolPayload);
    }
  }
}
