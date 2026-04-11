import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserRole } from "@prisma/client";
import { AxiosError } from "axios";
import { firstValueFrom } from "rxjs";
import { AnalyticsService } from "../analytics/analytics.service";
import { aiHttpHeaders } from "../integrations/ai-request-headers";
import type { TrendPoint } from "../analytics/dto/common.dto";
import type { JwtPayload } from "../common/types/jwt-payload";
import { PrismaService } from "../prisma/prisma.service";
import { RiskService } from "../risk/risk.service";
import { RiskLevel } from "../risk/dto/risk-level.enum";
import type { CohortSummaryResponse } from "./dto/cohort-summary.dto";

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

function parseDay(s: string): Date {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function meanInRange(
  points: TrendPoint[],
  start: Date,
  endExclusive: Date,
): number | null {
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

/** Percent change: last window vs previous window of equal length. */
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

function normalizeGradeKey(gradeLevel: string | null | undefined): string {
  const g = (gradeLevel ?? "").trim();
  return g.length ? g : "_unassigned";
}

function displayGradeName(key: string): string {
  if (key === "_unassigned") return "Unassigned grade";
  const lower = key.toLowerCase();
  if (lower.startsWith("grade")) return key;
  return `Grade ${key}`;
}

@Injectable()
export class CohortAnalyticsService {
  private readonly logger = new Logger(CohortAnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly risk: RiskService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private getAiBaseUrl(): string {
    return (this.config.get<string>("AI_SERVICE_URL") ?? "http://ai:8000").replace(/\/$/, "");
  }

  private async tryCohortAiSummary(payload: Record<string, unknown>): Promise<string | null> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ summary?: string }>(`${this.getAiBaseUrl()}/generate-cohort-summary`, payload, {
          headers: aiHttpHeaders(this.config),
          timeout: this.config.get<number>("AI_SERVICE_TIMEOUT_MS") ?? 60_000,
        }),
      );
      const s = res.data?.summary;
      return typeof s === "string" ? s : null;
    } catch (err) {
      if (err instanceof AxiosError) {
        this.logger.warn(`Cohort AI summary failed: ${err.response?.status ?? err.code}`);
      } else {
        this.logger.warn(`Cohort AI summary failed: ${err instanceof Error ? err.message : err}`);
      }
      return null;
    }
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

  async buildCohortSummary(
    schoolId: string,
    scoped: JwtPayload,
    studentIds: string[],
    classIds: string[],
    cohortId: string,
    cohortName: string,
    includeAi: boolean,
  ): Promise<CohortSummaryResponse> {
    const now = new Date();

    const [studentAnalyticsList, studentRisks, classAnalyticsList] = await Promise.all([
      Promise.all(studentIds.map((id) => this.analytics.getStudentAnalytics(id, scoped))),
      Promise.all(studentIds.map((id) => this.risk.getStudentRisk(schoolId, id, scoped))),
      Promise.all(classIds.map((id) => this.analytics.getClassAnalytics(id, scoped))),
    ]);

    const mean = (vals: number[]): number => {
      const v = vals.filter((x) => Number.isFinite(x));
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    };

    const studentPerf = mean(
      studentAnalyticsList.map((a) => {
        const pts = a.scoreTimeline ?? [];
        if (!pts.length) return 0;
        return pts.reduce((s, p) => s + p.value, 0) / pts.length;
      }),
    );
    const classPerf = mean(classAnalyticsList.map((a) => a.averageScore ?? 0));
    const performance =
      studentIds.length && classIds.length
        ? Math.round(((studentPerf + classPerf) / 2) * 10) / 10
        : studentIds.length
          ? Math.round(studentPerf * 10) / 10
          : Math.round(classPerf * 10) / 10;

    const studentAtt = mean(
      studentAnalyticsList.map((a) => {
        const pts = a.attendanceTimeline ?? [];
        if (!pts.length) return 0;
        return pts.reduce((s, p) => s + p.value, 0) / pts.length;
      }),
    );
    const classAtt = mean(classAnalyticsList.map((a) => a.attendanceRate ?? 0));
    const attendance =
      studentIds.length && classIds.length
        ? Math.round(((studentAtt + classAtt) / 2) * 1000) / 1000
        : studentIds.length
          ? Math.round(studentAtt * 1000) / 1000
          : Math.round(classAtt * 1000) / 1000;

    const studentEng = mean(studentAnalyticsList.map((a) => a.engagementScore ?? 0));
    const classEng = mean(classAnalyticsList.map((a) => a.engagementScore ?? 0));
    const engagement =
      studentIds.length && classIds.length
        ? Math.round(((studentEng + classEng) / 2) * 1000) / 1000
        : studentIds.length
          ? Math.round(studentEng * 1000) / 1000
          : Math.round(classEng * 1000) / 1000;

    let low = 0;
    let medium = 0;
    let high = 0;
    for (const r of studentRisks) {
      if (r.level === RiskLevel.LOW) low += 1;
      else if (r.level === RiskLevel.MEDIUM) medium += 1;
      else high += 1;
    }
    const riskAverage =
      studentRisks.length > 0
        ? Math.round(
            (studentRisks.reduce((s, r) => s + r.overall, 0) / studentRisks.length) * 10,
          ) / 10
        : 0;

    let interventions = 0;
    if (classIds.length && studentIds.length) {
      interventions = await this.prisma.intervention.count({
        where: {
          schoolId,
          OR: [{ classId: { in: classIds } }, { studentId: { in: studentIds } }],
        },
      });
    } else if (classIds.length) {
      interventions = await this.prisma.intervention.count({
        where: { schoolId, classId: { in: classIds } },
      });
    } else if (studentIds.length) {
      interventions = await this.prisma.intervention.count({
        where: { schoolId, studentId: { in: studentIds } },
      });
    }

    const scorePoints = mergeTrendPoints([
      ...studentAnalyticsList.flatMap((a) => a.scoreTimeline ?? []),
      ...classAnalyticsList.flatMap((a) => a.scoreTrend ?? []),
    ]);
    const attPoints = mergeTrendPoints(studentAnalyticsList.flatMap((a) => a.attendanceTimeline ?? []));

    const performance7 = trendPctPooled(scorePoints, now, 7);
    const performance30 = trendPctPooled(scorePoints, now, 30);
    const attendance7 = trendPctPooled(attPoints, now, 7);
    const attendance30 = trendPctPooled(attPoints, now, 30);

    const [engagement7, engagement30] = await Promise.all([
      this.engagementTrendPercent(schoolId, studentIds, 7),
      this.engagementTrendPercent(schoolId, studentIds, 30),
    ]);

    const summary: CohortSummaryResponse = {
      id: cohortId,
      name: cohortName,
      performance,
      attendance,
      engagement,
      risk: {
        low,
        medium,
        high,
        average: riskAverage,
      },
      interventions,
      trends: {
        performance7,
        attendance7,
        engagement7,
        performance30,
        attendance30,
        engagement30,
      },
      aiSummary: null,
    };

    if (includeAi) {
      summary.aiSummary = await this.tryCohortAiSummary({
        type: "cohort",
        cohortId,
        name: cohortName,
        schoolId,
        metrics: {
          performance,
          attendance,
          engagement,
          risk: summary.risk,
          interventions,
          trends: summary.trends,
        },
      });
    }

    return summary;
  }

  async listGradeCohorts(schoolId: string, user: JwtPayload) {
    const scoped = toPrincipalScope(user, schoolId);
    const students = await this.prisma.student.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true, gradeLevel: true },
    });
    const keys = new Set(students.map((s) => normalizeGradeKey(s.gradeLevel)));
    const classes = await this.loadClassesWithEnrollments(schoolId);
    const byGrade = this.mapClassesByGrade(classes);
    const out: CohortSummaryResponse[] = [];
    for (const key of [...keys].sort()) {
      const studentIds = students.filter((s) => normalizeGradeKey(s.gradeLevel) === key).map((s) => s.id);
      const classIds = byGrade.get(key) ?? [];
      const name = displayGradeName(key);
      out.push(
        await this.buildCohortSummary(schoolId, scoped, studentIds, classIds, key, name, false),
      );
    }
    return out;
  }

  async getGradeCohort(schoolId: string, gradeId: string, user: JwtPayload) {
    const scoped = toPrincipalScope(user, schoolId);
    const key = decodeURIComponent(gradeId);
    const students = await this.prisma.student.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true, gradeLevel: true },
    });
    const studentIds = students.filter((s) => normalizeGradeKey(s.gradeLevel) === key).map((s) => s.id);
    const classes = await this.loadClassesWithEnrollments(schoolId);
    const classIds = this.mapClassesByGrade(classes).get(key) ?? [];
    return this.buildCohortSummary(
      schoolId,
      scoped,
      studentIds,
      classIds,
      key,
      displayGradeName(key),
      true,
    );
  }

  async listSubjectCohorts(schoolId: string, user: JwtPayload) {
    const scoped = toPrincipalScope(user, schoolId);
    const subjects = await this.prisma.subject.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true, name: true, code: true },
    });
    const classes = await this.loadClassesWithEnrollments(schoolId);
    const bySubject = this.mapClassesBySubject(classes);
    const out: CohortSummaryResponse[] = [];
    for (const sub of subjects) {
      const classIds = bySubject.get(sub.id) ?? [];
      if (!classIds.length) continue;
      const studentIds = this.collectStudentIdsForClasses(classes, classIds);
      out.push(
        await this.buildCohortSummary(
          schoolId,
          scoped,
          studentIds,
          classIds,
          sub.id,
          `${sub.name} (${sub.code})`,
          false,
        ),
      );
    }
    return out;
  }

  async getSubjectCohort(schoolId: string, subjectId: string, user: JwtPayload) {
    const scoped = toPrincipalScope(user, schoolId);
    const sub = await this.prisma.subject.findFirst({
      where: { id: subjectId, schoolId, deletedAt: null },
    });
    if (!sub) {
      return null;
    }
    const classes = await this.loadClassesWithEnrollments(schoolId);
    const bySubject = this.mapClassesBySubject(classes);
    const classIds = bySubject.get(sub.id) ?? [];
    const studentIds = this.collectStudentIdsForClasses(classes, classIds);
    return this.buildCohortSummary(
      schoolId,
      scoped,
      studentIds,
      classIds,
      sub.id,
      `${sub.name} (${sub.code})`,
      true,
    );
  }

  private async loadClassesWithEnrollments(schoolId: string) {
    return this.prisma.class.findMany({
      where: { schoolId, deletedAt: null },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        enrollments: {
          where: { status: "active", deletedAt: null },
          include: {
            student: { select: { id: true, gradeLevel: true } },
          },
        },
      },
    });
  }

  private mapClassesByGrade(
    classes: {
      id: string;
      enrollments: { student: { gradeLevel: string | null } }[];
    }[],
  ): Map<string, string[]> {
    const m = new Map<string, Set<string>>();
    for (const c of classes) {
      for (const e of c.enrollments) {
        const k = normalizeGradeKey(e.student.gradeLevel);
        if (!m.has(k)) m.set(k, new Set());
        m.get(k)!.add(c.id);
      }
    }
    return new Map([...m.entries()].map(([k, v]) => [k, [...v]]));
  }

  private mapClassesBySubject(classes: { id: string; subjectId: string }[]): Map<string, string[]> {
    const m = new Map<string, string[]>();
    for (const c of classes) {
      const sid = c.subjectId;
      if (!m.has(sid)) m.set(sid, []);
      m.get(sid)!.push(c.id);
    }
    return m;
  }

  private collectStudentIdsForClasses(
    classes: {
      id: string;
      enrollments: { studentId: string }[];
    }[],
    classIds: string[],
  ): string[] {
    const set = new Set<string>();
    const idSet = new Set(classIds);
    for (const c of classes) {
      if (!idSet.has(c.id)) continue;
      for (const e of c.enrollments) set.add(e.studentId);
    }
    return [...set];
  }
}
