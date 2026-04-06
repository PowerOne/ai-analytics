import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { JwtPayload } from "../common/types/jwt-payload";
import { scopeAttendance, scopeClasses, scopeStudents } from "../common/tenant-scope";
import type { ClassAnalyticsResponse } from "./dto/class-analytics.dto";
import type { StudentAnalyticsResponse } from "./dto/student-analytics.dto";
import type { TrendPoint } from "./dto/common.dto";

function toNum(v: { toString(): string } | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

function formatDateYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const PRESENT_LIKE = new Set(["present", "late", "excused"]);

function mergeNumericBuckets(
  buckets: Map<string, { sum: number; count: number }>,
  date: string,
  value: number | null,
) {
  if (value == null || !Number.isFinite(value)) return;
  const cur = buckets.get(date) ?? { sum: 0, count: 0 };
  cur.sum += value;
  cur.count += 1;
  buckets.set(date, cur);
}

function bucketsToTrendPoints(buckets: Map<string, { sum: number; count: number }>): TrendPoint[] {
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { sum, count }]) => ({
      date,
      value: count === 0 ? 0 : sum / count,
    }));
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getClassForAnalytics(classId: string, user: JwtPayload) {
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, ...scopeClasses(user) },
      include: {
        subject: { select: { name: true, code: true } },
        term: { select: { label: true } },
      },
    });
    if (!cls) throw new NotFoundException("Class not found");
    if (user.role === UserRole.TEACHER && user.teacherId && cls.primaryTeacherId !== user.teacherId) {
      throw new ForbiddenException("Not assigned to this class");
    }
    return cls;
  }

  private classAssessmentResultWhere(classId: string, user: JwtPayload): Prisma.AssessmentResultWhereInput {
    return {
      schoolId: user.schoolId,
      deletedAt: null,
      assessment: {
        classId,
        schoolId: user.schoolId,
        deletedAt: null,
        ...(user.role === UserRole.TEACHER && user.teacherId
          ? { class: { primaryTeacherId: user.teacherId, deletedAt: null } }
          : {}),
      },
    };
  }

  private studentAssessmentResultWhere(studentId: string, user: JwtPayload): Prisma.AssessmentResultWhereInput {
    return {
      schoolId: user.schoolId,
      studentId,
      deletedAt: null,
      assessment: {
        schoolId: user.schoolId,
        deletedAt: null,
        ...(user.role === UserRole.TEACHER && user.teacherId
          ? { class: { primaryTeacherId: user.teacherId, deletedAt: null } }
          : {}),
      },
    };
  }

  private lmsWhereForStudent(studentId: string, user: JwtPayload): Prisma.LmsActivityEventWhereInput {
    const base: Prisma.LmsActivityEventWhereInput = {
      schoolId: user.schoolId,
      studentId,
      deletedAt: null,
    };
    if (user.role === UserRole.TEACHER && user.teacherId) {
      return {
        ...base,
        OR: [
          { classId: null },
          { class: { primaryTeacherId: user.teacherId, deletedAt: null } },
        ],
      };
    }
    return base;
  }

  private lmsWhereForClass(classId: string, user: JwtPayload): Prisma.LmsActivityEventWhereInput {
    return {
      schoolId: user.schoolId,
      classId,
      deletedAt: null,
      ...(user.role === UserRole.TEACHER && user.teacherId
        ? { class: { primaryTeacherId: user.teacherId, deletedAt: null } }
        : {}),
    };
  }

  private async computeClassAverageScore(classId: string, user: JwtPayload): Promise<number> {
    const agg = await this.prisma.assessmentResult.aggregate({
      where: this.classAssessmentResultWhere(classId, user),
      _avg: { scorePercent: true },
    });
    return toNum(agg._avg.scorePercent) ?? 0;
  }

  private async computeClassScoreTrend(classId: string, user: JwtPayload): Promise<TrendPoint[]> {
    const rows = await this.prisma.assessmentResult.findMany({
      where: {
        ...this.classAssessmentResultWhere(classId, user),
        submittedAt: { not: null },
      },
      select: { submittedAt: true, scorePercent: true },
    });
    const buckets = new Map<string, { sum: number; count: number }>();
    for (const row of rows) {
      if (!row.submittedAt) continue;
      const pct = toNum(row.scorePercent);
      mergeNumericBuckets(buckets, formatDateYmd(row.submittedAt), pct);
    }
    return bucketsToTrendPoints(buckets);
  }

  private async computeClassAttendanceRate(classId: string, user: JwtPayload): Promise<number> {
    const grouped = await this.prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: {
        classId,
        ...scopeAttendance(user),
      },
      _count: true,
    });
    let total = 0;
    let presentLike = 0;
    for (const row of grouped) {
      total += row._count;
      if (PRESENT_LIKE.has(row.status)) presentLike += row._count;
    }
    return total === 0 ? 0 : presentLike / total;
  }

  private async computeClassSubmissionRate(classId: string, user: JwtPayload): Promise<number> {
    const where = this.classAssessmentResultWhere(classId, user);
    const [submitted, total] = await Promise.all([
      this.prisma.assessmentResult.count({
        where: { ...where, submittedAt: { not: null } },
      }),
      this.prisma.assessmentResult.count({ where }),
    ]);
    return total === 0 ? 0 : submitted / total;
  }

  private async computeClassEngagementScore(classId: string, user: JwtPayload): Promise<number> {
    const agg = await this.prisma.lmsActivityEvent.aggregate({
      where: this.lmsWhereForClass(classId, user),
      _avg: { engagementScore: true },
    });
    return toNum(agg._avg.engagementScore) ?? 0;
  }

  async getClassAverageScore(classId: string, user: JwtPayload): Promise<number> {
    await this.getClassForAnalytics(classId, user);
    return this.computeClassAverageScore(classId, user);
  }

  async getClassScoreTrend(classId: string, user: JwtPayload): Promise<TrendPoint[]> {
    await this.getClassForAnalytics(classId, user);
    return this.computeClassScoreTrend(classId, user);
  }

  async getClassAttendanceRate(classId: string, user: JwtPayload): Promise<number> {
    await this.getClassForAnalytics(classId, user);
    return this.computeClassAttendanceRate(classId, user);
  }

  async getClassSubmissionRate(classId: string, user: JwtPayload): Promise<number> {
    await this.getClassForAnalytics(classId, user);
    return this.computeClassSubmissionRate(classId, user);
  }

  async getClassEngagementScore(classId: string, user: JwtPayload): Promise<number> {
    await this.getClassForAnalytics(classId, user);
    return this.computeClassEngagementScore(classId, user);
  }

  async getClassAnalytics(classId: string, user: JwtPayload): Promise<ClassAnalyticsResponse> {
    await this.getClassForAnalytics(classId, user);
    const [averageScore, scoreTrend, attendanceRate, submissionRate, engagementScore] = await Promise.all([
      this.computeClassAverageScore(classId, user),
      this.computeClassScoreTrend(classId, user),
      this.computeClassAttendanceRate(classId, user),
      this.computeClassSubmissionRate(classId, user),
      this.computeClassEngagementScore(classId, user),
    ]);
    return {
      averageScore,
      scoreTrend,
      attendanceRate,
      submissionRate,
      engagementScore,
    };
  }

  private async getStudentForAnalytics(studentId: string, user: JwtPayload) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, ...scopeStudents(user) },
    });
    if (!student) throw new NotFoundException("Student not found");
    return student;
  }

  private async computeStudentScoreTimeline(studentId: string, user: JwtPayload): Promise<TrendPoint[]> {
    const rows = await this.prisma.assessmentResult.findMany({
      where: {
        ...this.studentAssessmentResultWhere(studentId, user),
        submittedAt: { not: null },
      },
      select: { submittedAt: true, scorePercent: true },
    });
    const buckets = new Map<string, { sum: number; count: number }>();
    for (const row of rows) {
      if (!row.submittedAt) continue;
      mergeNumericBuckets(buckets, formatDateYmd(row.submittedAt), toNum(row.scorePercent));
    }
    return bucketsToTrendPoints(buckets);
  }

  private async computeStudentAttendanceTimeline(studentId: string, user: JwtPayload): Promise<TrendPoint[]> {
    const rows = await this.prisma.attendanceRecord.findMany({
      where: {
        studentId,
        ...scopeAttendance(user),
      },
      select: { sessionDate: true, status: true },
    });
    const dayBuckets = new Map<string, { total: number; presentLike: number }>();
    for (const row of rows) {
      const day = formatDateYmd(row.sessionDate);
      const cur = dayBuckets.get(day) ?? { total: 0, presentLike: 0 };
      cur.total += 1;
      if (PRESENT_LIKE.has(row.status)) cur.presentLike += 1;
      dayBuckets.set(day, cur);
    }
    return [...dayBuckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { total, presentLike }]) => ({
        date,
        value: total === 0 ? 0 : presentLike / total,
      }));
  }

  private async computeStudentEngagementScore(studentId: string, user: JwtPayload): Promise<number> {
    const agg = await this.prisma.lmsActivityEvent.aggregate({
      where: this.lmsWhereForStudent(studentId, user),
      _avg: { engagementScore: true },
    });
    return toNum(agg._avg.engagementScore) ?? 0;
  }

  private async computeStudentSubmissionRate(studentId: string, user: JwtPayload): Promise<number> {
    const where = this.studentAssessmentResultWhere(studentId, user);
    const [submitted, total] = await Promise.all([
      this.prisma.assessmentResult.count({
        where: { ...where, submittedAt: { not: null } },
      }),
      this.prisma.assessmentResult.count({ where }),
    ]);
    return total === 0 ? 0 : submitted / total;
  }

  async getStudentScoreTimeline(studentId: string, user: JwtPayload): Promise<TrendPoint[]> {
    await this.getStudentForAnalytics(studentId, user);
    return this.computeStudentScoreTimeline(studentId, user);
  }

  async getStudentAttendanceTimeline(studentId: string, user: JwtPayload): Promise<TrendPoint[]> {
    await this.getStudentForAnalytics(studentId, user);
    return this.computeStudentAttendanceTimeline(studentId, user);
  }

  async getStudentEngagementScore(studentId: string, user: JwtPayload): Promise<number> {
    await this.getStudentForAnalytics(studentId, user);
    return this.computeStudentEngagementScore(studentId, user);
  }

  async getStudentSubmissionRate(studentId: string, user: JwtPayload): Promise<number> {
    await this.getStudentForAnalytics(studentId, user);
    return this.computeStudentSubmissionRate(studentId, user);
  }

  async getStudentAnalytics(studentId: string, user: JwtPayload): Promise<StudentAnalyticsResponse> {
    await this.getStudentForAnalytics(studentId, user);
    const [scoreTimeline, attendanceTimeline, engagementScore, submissionRate] = await Promise.all([
      this.computeStudentScoreTimeline(studentId, user),
      this.computeStudentAttendanceTimeline(studentId, user),
      this.computeStudentEngagementScore(studentId, user),
      this.computeStudentSubmissionRate(studentId, user),
    ]);
    return {
      scoreTimeline,
      attendanceTimeline,
      engagementScore,
      submissionRate,
    };
  }

  async getClassPerformanceSummary(classId: string, user: JwtPayload) {
    const cls = await this.getClassForAnalytics(classId, user);

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        schoolId: user.schoolId,
        classId,
        deletedAt: null,
        status: "active",
      },
      select: { studentId: true },
    });
    const studentIds = enrollments.map((e) => e.studentId);

    const assessmentAgg = await this.prisma.assessmentResult.aggregate({
      where: {
        schoolId: user.schoolId,
        deletedAt: null,
        assessment: { classId, schoolId: user.schoolId, deletedAt: null },
      },
      _avg: { scorePercent: true },
      _count: true,
    });

    const perStudent = await this.prisma.assessmentResult.groupBy({
      by: ["studentId"],
      where: {
        schoolId: user.schoolId,
        deletedAt: null,
        studentId: { in: studentIds },
        assessment: { classId, schoolId: user.schoolId, deletedAt: null },
      },
      _avg: { scorePercent: true },
    });

    const attendanceStats = await this.prisma.attendanceRecord.groupBy({
      by: ["studentId", "status"],
      where: {
        schoolId: user.schoolId,
        classId,
        deletedAt: null,
        studentId: { in: studentIds },
      },
      _count: true,
    });

    const attendanceByStudent = new Map<string, { total: number; presentLike: number }>();
    for (const sid of studentIds) attendanceByStudent.set(sid, { total: 0, presentLike: 0 });
    for (const row of attendanceStats) {
      const cur = attendanceByStudent.get(row.studentId) ?? { total: 0, presentLike: 0 };
      cur.total += row._count;
      if (PRESENT_LIKE.has(row.status)) cur.presentLike += row._count;
      attendanceByStudent.set(row.studentId, cur);
    }

    const scoreMap = new Map(perStudent.map((p) => [p.studentId, toNum(p._avg.scorePercent)]));
    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds }, schoolId: user.schoolId },
      select: { id: true, displayName: true, givenName: true, familyName: true },
    });

    return {
      classId: cls.id,
      className: cls.name,
      subject: cls.subject,
      term: cls.term,
      summary: {
        studentCount: studentIds.length,
        assessmentResultRows: assessmentAgg._count,
        avgScorePercent: toNum(assessmentAgg._avg.scorePercent),
      },
      students: students.map((s) => {
        const att = attendanceByStudent.get(s.id) ?? { total: 0, presentLike: 0 };
        const attendanceRate = att.total === 0 ? null : att.presentLike / att.total;
        return {
          studentId: s.id,
          displayName:
            s.displayName ?? ([s.givenName, s.familyName].filter(Boolean).join(" ") || s.id),
          avgScorePercent: scoreMap.get(s.id) ?? null,
          attendanceRate,
          riskScore: null as number | null,
          engagementScore: null as number | null,
          aiNotes: "risk_score and engagement_score reserved for AI service",
        };
      }),
    };
  }

  async getStudentAnalyticsSummary(studentId: string, user: JwtPayload) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, ...scopeStudents(user) },
    });
    if (!student) throw new NotFoundException("Student not found");

    const perf = await this.prisma.assessmentResult.aggregate({
      where: {
        schoolId: user.schoolId,
        studentId,
        deletedAt: null,
        assessment: {
          schoolId: user.schoolId,
          deletedAt: null,
          ...(user.role === UserRole.TEACHER && user.teacherId
            ? { class: { primaryTeacherId: user.teacherId, deletedAt: null } }
            : {}),
        },
      },
      _avg: { scorePercent: true },
      _count: true,
    });

    const attCounts = await this.prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { schoolId: user.schoolId, studentId, deletedAt: null },
      _count: true,
    });
    let totalSessions = 0;
    let presentSessions = 0;
    for (const row of attCounts) {
      totalSessions += row._count;
      if (PRESENT_LIKE.has(row.status)) presentSessions += row._count;
    }

    const lms = await this.prisma.lmsActivityEvent.aggregate({
      where: { schoolId: user.schoolId, studentId, deletedAt: null },
      _avg: { engagementScore: true },
      _count: true,
    });

    return {
      studentId: student.id,
      displayName:
        student.displayName ??
        ([student.givenName, student.familyName].filter(Boolean).join(" ") || student.id),
      performance: {
        avgScorePercent: toNum(perf._avg.scorePercent),
        assessmentResultCount: perf._count,
      },
      attendance: {
        sessionsRecorded: totalSessions,
        presentLikeSessions: presentSessions,
        presentRate: totalSessions === 0 ? null : presentSessions / totalSessions,
      },
      engagement: {
        lmsEventCount: lms._count,
        avgEngagementScoreFromLms: toNum(lms._avg.engagementScore),
      },
      ai: {
        riskScore: null as number | null,
        engagementScore: null as number | null,
        source: "Set by AI service when integrated",
      },
    };
  }
}
