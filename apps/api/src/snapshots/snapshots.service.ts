import { Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AnalyticsService } from "../analytics/analytics.service";
import type { JwtPayload } from "../common/types/jwt-payload";
import { PrismaService } from "../prisma/prisma.service";
import { RiskService } from "../risk/risk.service";
import { RiskLevel } from "../risk/dto/risk-level.enum";
import type { RiskInput } from "../risk/risk-engine.types";
import { computeSnapshotStability } from "../weekly-reports/snapshot-stability.util";

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
    private readonly prisma: PrismaService,
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

  async runWeeklySnapshot(): Promise<void> {
    const weekStart = mondayUtcContaining(new Date());
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);

    const schools = await this.prisma.school.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });

    for (const { id: schoolId } of schools) {
      const scoped = this.principalScope(schoolId);

      const enrollments = await this.prisma.enrollment.findMany({
        where: { schoolId, status: "active", deletedAt: null },
        select: {
          studentId: true,
          classId: true,
          student: {
            select: {
              id: true,
              classId: true,
              performance: true,
              attendance: true,
              engagement: true,
              riskScore: true,
              deltas: true,
              tiers: true,
              flags: true,
              stability: true,
            },
          },
        },
      });

      const studentIdToClassId = new Map<string, string>();
      const studentRowById = new Map<string, (typeof enrollments)[0]["student"]>();
      for (const e of enrollments) {
        if (!studentIdToClassId.has(e.studentId)) {
          studentIdToClassId.set(e.studentId, e.classId);
          studentRowById.set(e.studentId, e.student);
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

        const lastSnap = await this.prisma.weeklyStudentSnapshot.findFirst({
          where: { schoolId, studentId, weekStartDate: lastWeekStart },
        });

        const perfDelta = lastSnap?.performance != null ? perf - (lastSnap.performance ?? 0) : 0;
        const attDelta = lastSnap?.attendance != null ? att - (lastSnap.attendance ?? 0) : 0;
        const engDelta = lastSnap?.engagement != null ? eng - (lastSnap.engagement ?? 0) : 0;
        const riskDelta =
          lastSnap?.riskScore != null ? riskScore - (lastSnap.riskScore ?? 0) : 0;

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
              performance: lastSnap.performance,
              attendance: lastSnap.attendance,
              engagement: lastSnap.engagement,
              riskScore: lastSnap.riskScore,
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

        const existing = await this.prisma.weeklyStudentSnapshot.findFirst({
          where: { schoolId, studentId, weekStartDate: weekStart },
        });

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

        if (existing) {
          await this.prisma.weeklyStudentSnapshot.update({
            where: { id: existing.id },
            data: payload,
          });
        } else {
          await this.prisma.weeklyStudentSnapshot.create({
            data: {
              schoolId,
              studentId,
              weekStartDate: weekStart,
              ...payload,
            },
          });
        }

        if (!riskInputsByClass.has(classId)) riskInputsByClass.set(classId, []);
        riskInputsByClass.get(classId)!.push(riskInput);
      }

      const classes = await this.prisma.class.findMany({
        where: { schoolId, deletedAt: null },
        select: { id: true },
      });

      for (const { id: classId } of classes) {
        const inputs = riskInputsByClass.get(classId) ?? [];
        const engineClass = inputs.length ? this.risk.getClassRiskEngine(inputs) : null;

        const classExisting = await this.prisma.weeklyClassSnapshot.findFirst({
          where: { schoolId, classId, weekStartDate: weekStart },
        });

        const classA = await this.analytics.getClassAnalytics(classId, scoped);
        const perf = classA.averageScore ?? 0;
        const att = classA.attendanceRate ?? 0;
        const eng = classA.engagementScore ?? 0;
        const classR = await this.risk.getClassRisk(schoolId, classId, scoped);

        const lastClass = await this.prisma.weeklyClassSnapshot.findFirst({
          where: { schoolId, classId, weekStartDate: lastWeekStart },
        });

        const classPayload = {
          performance: perf,
          attendance: att,
          engagement: eng,
          riskScore: classR.overall,
          riskComposite: engineClass?.classRisk ?? undefined,
          riskCategory: engineClass
            ? engineClass.distribution.high > 0
              ? "high"
              : engineClass.distribution.medium >= engineClass.distribution.low
                ? "medium"
                : "low"
            : undefined,
          riskReasons: [],
          riskStability: engineClass
            ? inputs.reduce((s, i) => s + i.stability, 0) / Math.max(1, inputs.length)
            : undefined,
          riskDeltas: engineClass
            ? {
                performance: lastClass?.performance != null ? perf - (lastClass.performance ?? 0) : 0,
                attendance: lastClass?.attendance != null ? att - (lastClass.attendance ?? 0) : 0,
                engagement: lastClass?.engagement != null ? eng - (lastClass.engagement ?? 0) : 0,
                risk: lastClass?.riskScore != null ? classR.overall - (lastClass.riskScore ?? 0) : 0,
              }
            : undefined,
        };

        if (classExisting) {
          await this.prisma.weeklyClassSnapshot.update({
            where: { id: classExisting.id },
            data: classPayload,
          });
        } else {
          await this.prisma.weeklyClassSnapshot.create({
            data: {
              schoolId,
              classId,
              weekStartDate: weekStart,
              ...classPayload,
            },
          });
        }
      }

      const studentSnaps = await this.prisma.weeklyStudentSnapshot.findMany({
        where: { schoolId, weekStartDate: weekStart },
      });

      const avg = (xs: (number | null | undefined)[]) => {
        const vals = xs.filter((x): x is number => x != null && Number.isFinite(x));
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      };

      const schoolExisting = await this.prisma.weeklySchoolSnapshot.findFirst({
        where: { schoolId, weekStartDate: weekStart },
      });

      const schoolPayload = {
        performance: avg(studentSnaps.map((s) => s.performance)),
        attendance: avg(studentSnaps.map((s) => s.attendance)),
        engagement: avg(studentSnaps.map((s) => s.engagement)),
        riskLow: studentSnaps.filter((s) => (s.riskTier ?? "").toUpperCase() === "LOW").length,
        riskMedium: studentSnaps.filter((s) => (s.riskTier ?? "").toUpperCase() === "MEDIUM").length,
        riskHigh: studentSnaps.filter((s) => (s.riskTier ?? "").toUpperCase() === "HIGH").length,
        riskAverage: avg(studentSnaps.map((s) => s.riskScore)),
        riskComposite: avg(studentSnaps.map((s) => s.riskComposite)),
        riskCategory:
          studentSnaps.filter((s) => (s.riskCategory ?? "") === "high").length >
          studentSnaps.length / 2
            ? "high"
            : studentSnaps.filter((s) => (s.riskCategory ?? "") === "medium").length > 0
              ? "medium"
              : "low",
        riskReasons: [],
        riskStability: avg(studentSnaps.map((s) => s.riskStability)) ?? undefined,
        riskDeltas: undefined,
      };

      if (schoolExisting) {
        await this.prisma.weeklySchoolSnapshot.update({
          where: { id: schoolExisting.id },
          data: schoolPayload,
        });
      } else {
        await this.prisma.weeklySchoolSnapshot.create({
          data: {
            schoolId,
            weekStartDate: weekStart,
            interventionsCreated: 0,
            interventionsResolved: 0,
            ...schoolPayload,
          },
        });
      }
    }
  }
}
