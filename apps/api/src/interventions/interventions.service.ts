import { HttpService } from "@nestjs/axios";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserRole } from "@prisma/client";
import type { Intervention, Prisma } from "@prisma/client";
import { AxiosError } from "axios";
import { firstValueFrom } from "rxjs";
import { AnalyticsService } from "../analytics/analytics.service";
import { aiHttpHeaders } from "../integrations/ai-request-headers";
import type { TrendPoint } from "../analytics/dto/common.dto";
import type { JwtPayload } from "../common/types/jwt-payload";
import { PrismaService } from "../prisma/prisma.service";
import { RiskService } from "../risk/risk.service";
import type { CreateInterventionDto } from "./dto/create-intervention.dto";
import type { InterventionResponseDto } from "./dto/intervention-response.dto";
import type { UpdateInterventionDto } from "./dto/update-intervention.dto";

const PRESENT_LIKE = new Set(["present", "late", "excused"]);

function toPrincipalScope(user: JwtPayload, schoolId: string): JwtPayload {
  return {
    sub: user.sub,
    email: user.email,
    schoolId,
    role: UserRole.PRINCIPAL,
    teacherId: null,
  };
}

function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function meanTrendInRange(points: TrendPoint[], start: Date, endExclusive: Date): number | null {
  const vals: number[] = [];
  const startT = start.getTime();
  const endT = endExclusive.getTime();
  for (const p of points) {
    const t = parseDay(p.date).getTime();
    if (t >= startT && t < endT && Number.isFinite(p.value)) vals.push(p.value);
  }
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

@Injectable()
export class InterventionsService {
  private readonly logger = new Logger(InterventionsService.name);

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

  toResponse(row: Intervention): InterventionResponseDto {
    return {
      id: row.id,
      schoolId: row.schoolId,
      teacherId: row.teacherId,
      classId: row.classId,
      studentId: row.studentId,
      triggerType: row.triggerType,
      description: row.description,
      recommendations: row.recommendations ?? null,
      status: row.status,
      notes: row.notes ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private assertTeacherOwnsIntervention(user: JwtPayload, teacherId: string): void {
    if (user.role === UserRole.TEACHER && user.teacherId !== teacherId) {
      throw new ForbiddenException("Cannot access another teacher's intervention");
    }
  }

  private async tryAiRecommendations(payload: Record<string, unknown>): Promise<Prisma.InputJsonValue | null> {
    try {
      const url = `${this.getAiBaseUrl()}/generate-intervention-recommendations`;
      const res = await firstValueFrom(
        this.http.post<unknown>(url, payload, {
          headers: aiHttpHeaders(this.config),
          timeout: this.config.get<number>("AI_SERVICE_TIMEOUT_MS") ?? 60_000,
        }),
      );
      return (res.data ?? null) as Prisma.InputJsonValue | null;
    } catch (err) {
      if (err instanceof AxiosError) {
        this.logger.warn(`AI recommendations failed: ${err.response?.status ?? err.code}`);
      } else {
        this.logger.warn(`AI recommendations failed: ${err instanceof Error ? err.message : err}`);
      }
      return null;
    }
  }

  private async validateEntities(
    schoolId: string,
    teacherId: string,
    classId: string | undefined,
    studentId: string | undefined,
  ): Promise<void> {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, schoolId, deletedAt: null },
    });
    if (!teacher) throw new BadRequestException("Teacher not found in this school");

    if (classId) {
      const cls = await this.prisma.class.findFirst({
        where: { id: classId, schoolId, deletedAt: null },
      });
      if (!cls) throw new BadRequestException("Class not found in this school");
    }
    if (studentId) {
      const st = await this.prisma.student.findFirst({
        where: { id: studentId, schoolId, deletedAt: null },
      });
      if (!st) throw new BadRequestException("Student not found in this school");
    }
  }

  async createIntervention(
    schoolId: string,
    dto: CreateInterventionDto,
    user: JwtPayload,
  ): Promise<InterventionResponseDto> {
    if (user.role === UserRole.TEACHER) {
      if (!user.teacherId || user.teacherId !== dto.teacherId) {
        throw new ForbiddenException("Teachers can only create interventions for themselves");
      }
    }

    await this.validateEntities(schoolId, dto.teacherId, dto.classId, dto.studentId);

    const aiPayload = {
      schoolId,
      teacherId: dto.teacherId,
      classId: dto.classId ?? null,
      studentId: dto.studentId ?? null,
      triggerType: dto.triggerType,
      description: dto.description,
    };
    const recommendations = await this.tryAiRecommendations(aiPayload);

    const row = await this.prisma.intervention.create({
      data: {
        schoolId,
        teacherId: dto.teacherId,
        classId: dto.classId ?? null,
        studentId: dto.studentId ?? null,
        triggerType: dto.triggerType,
        description: dto.description,
        recommendations: recommendations ?? undefined,
        status: "open",
      },
    });
    return this.toResponse(row);
  }

  async listInterventions(schoolId: string, user: JwtPayload): Promise<InterventionResponseDto[]> {
    const where: Prisma.InterventionWhereInput = { schoolId };
    if (user.role === UserRole.TEACHER) {
      if (!user.teacherId) return [];
      where.teacherId = user.teacherId;
    }
    const rows = await this.prisma.intervention.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.toResponse(r));
  }

  async getIntervention(schoolId: string, id: string, user: JwtPayload): Promise<InterventionResponseDto> {
    const row = await this.prisma.intervention.findFirst({
      where: { id, schoolId },
    });
    if (!row) throw new NotFoundException("Intervention not found");
    this.assertTeacherOwnsIntervention(user, row.teacherId);
    return this.toResponse(row);
  }

  async updateIntervention(
    schoolId: string,
    id: string,
    dto: UpdateInterventionDto,
    user: JwtPayload,
  ): Promise<InterventionResponseDto> {
    const row = await this.prisma.intervention.findFirst({
      where: { id, schoolId },
    });
    if (!row) throw new NotFoundException("Intervention not found");
    this.assertTeacherOwnsIntervention(user, row.teacherId);

    const data: Prisma.InterventionUpdateInput = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.recommendations !== undefined) {
      data.recommendations = dto.recommendations as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.intervention.update({
      where: { id: row.id },
      data,
    });
    return this.toResponse(updated);
  }

  private async hasOpenDuplicate(
    schoolId: string,
    teacherId: string,
    classId: string | null,
    studentId: string | null,
    triggerType: string,
  ): Promise<boolean> {
    const existing = await this.prisma.intervention.findFirst({
      where: {
        schoolId,
        teacherId,
        classId: classId ?? null,
        studentId: studentId ?? null,
        triggerType,
        status: { in: ["open", "in_progress"] },
      },
    });
    return !!existing;
  }

  private async createAuto(
    schoolId: string,
    teacherId: string,
    classId: string | null,
    studentId: string | null,
    triggerType: string,
    description: string,
    details: Record<string, unknown>,
  ): Promise<boolean> {
    if (await this.hasOpenDuplicate(schoolId, teacherId, classId, studentId, triggerType)) {
      return false;
    }
    const recommendations = await this.tryAiRecommendations({
      schoolId,
      teacherId,
      classId,
      studentId,
      triggerType,
      description,
      details,
    });
    await this.prisma.intervention.create({
      data: {
        schoolId,
        teacherId,
        classId,
        studentId,
        triggerType,
        description,
        recommendations: recommendations ?? undefined,
        status: "open",
      },
    });
    return true;
  }

  async autoCheck(schoolId: string, user: JwtPayload): Promise<{
    created: number;
    skippedDuplicates: number;
    failedChecks: number;
    riskClass: number;
    riskStudent: number;
    attendanceDrop: number;
    engagementDrop: number;
    classScoreDrop: number;
    classAttendanceDrop: number;
  }> {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.PRINCIPAL) {
      throw new ForbiddenException("Only administrators can run school-wide auto-check");
    }
    if (user.schoolId !== schoolId) {
      throw new ForbiddenException("School mismatch");
    }

    const scoped = toPrincipalScope(user, schoolId);
    let created = 0;
    let skippedDuplicates = 0;
    let failedChecks = 0;
    let riskClass = 0;
    let riskStudent = 0;
    let attendanceDrop = 0;
    let engagementDrop = 0;
    let classScoreDrop = 0;
    let classAttendanceDrop = 0;

    const now = new Date();
    const last7Start = new Date(now);
    last7Start.setUTCDate(last7Start.getUTCDate() - 7);
    const prev7Start = new Date(now);
    prev7Start.setUTCDate(prev7Start.getUTCDate() - 14);

    const classes = await this.prisma.class.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true, primaryTeacherId: true, name: true },
    });

    for (const c of classes) {
      if (!c.primaryTeacherId) continue;
      try {
        const r = await this.risk.getClassRisk(schoolId, c.id, scoped);
        if (r.overall > 70) {
          riskClass += 1;
          const ok = await this.createAuto(
            schoolId,
            c.primaryTeacherId,
            c.id,
            null,
            "auto_risk_class",
            `Class "${c.name}" overall risk score ${r.overall} exceeds threshold (70).`,
            { risk: r },
          );
          if (ok) created += 1;
          else skippedDuplicates += 1;
        }
      } catch {
        failedChecks += 1;
      }
    }

    const students = await this.prisma.student.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true },
    });

    for (const s of students) {
      const en = await this.prisma.enrollment.findFirst({
        where: {
          studentId: s.id,
          schoolId,
          deletedAt: null,
          status: "active",
          class: { deletedAt: null, primaryTeacherId: { not: null } },
        },
        include: { class: { select: { primaryTeacherId: true } } },
      });
      const teacherId = en?.class.primaryTeacherId ?? null;
      if (!teacherId) {
        failedChecks += 1;
        continue;
      }

      try {
        const r = await this.risk.getStudentRisk(schoolId, s.id, scoped);
        if (r.overall > 70) {
          riskStudent += 1;
          const ok = await this.createAuto(
            schoolId,
            teacherId,
            null,
            s.id,
            "auto_risk_student",
            `Student overall risk score ${r.overall} exceeds threshold (70).`,
            { risk: r },
          );
          if (ok) created += 1;
          else skippedDuplicates += 1;
        }
      } catch {
        failedChecks += 1;
      }

      try {
        const a = await this.analytics.getStudentAnalytics(s.id, scoped);
        const lastAvg = meanTrendInRange(a.attendanceTimeline ?? [], last7Start, now);
        const prevAvg = meanTrendInRange(a.attendanceTimeline ?? [], prev7Start, last7Start);
        if (
          lastAvg != null &&
          prevAvg != null &&
          prevAvg > 0 &&
          (prevAvg - lastAvg) / prevAvg > 0.2
        ) {
          attendanceDrop += 1;
          const ok = await this.createAuto(
            schoolId,
            teacherId,
            null,
            s.id,
            "auto_attendance_drop",
            `Attendance rate dropped more than 20% vs prior 7 days (was ~${(prevAvg * 100).toFixed(0)}%, now ~${(lastAvg * 100).toFixed(0)}%).`,
            { prevAvg, lastAvg },
          );
          if (ok) created += 1;
          else skippedDuplicates += 1;
        }
      } catch {
        failedChecks += 1;
      }

      try {
        const lastEng = await this.prisma.lmsActivityEvent.aggregate({
          where: {
            schoolId,
            studentId: s.id,
            deletedAt: null,
            occurredAt: { gte: last7Start },
          },
          _avg: { engagementScore: true },
        });
        const prevEng = await this.prisma.lmsActivityEvent.aggregate({
          where: {
            schoolId,
            studentId: s.id,
            deletedAt: null,
            occurredAt: { gte: prev7Start, lt: last7Start },
          },
          _avg: { engagementScore: true },
        });
        const last = lastEng._avg.engagementScore ? Number(lastEng._avg.engagementScore) : 0;
        const prev = prevEng._avg.engagementScore ? Number(prevEng._avg.engagementScore) : 0;
        if (prev > 0 && (prev - last) / prev > 0.2) {
          engagementDrop += 1;
          const ok = await this.createAuto(
            schoolId,
            teacherId,
            null,
            s.id,
            "auto_engagement_drop",
            `Average LMS engagement dropped more than 20% vs prior 7 days.`,
            { prevAvgEngagement: prev, lastAvgEngagement: last },
          );
          if (ok) created += 1;
          else skippedDuplicates += 1;
        }
      } catch {
        failedChecks += 1;
      }
    }

    for (const c of classes) {
      if (!c.primaryTeacherId) continue;
      try {
        const a = await this.analytics.getClassAnalytics(c.id, scoped);
        const lastAvg = meanTrendInRange(a.scoreTrend ?? [], last7Start, now);
        const prevAvg = meanTrendInRange(a.scoreTrend ?? [], prev7Start, last7Start);
        if (
          lastAvg != null &&
          prevAvg != null &&
          prevAvg > 0 &&
          (prevAvg - lastAvg) / prevAvg > 0.2
        ) {
          classScoreDrop += 1;
          const ok = await this.createAuto(
            schoolId,
            c.primaryTeacherId,
            c.id,
            null,
            "auto_class_score_drop",
            `Class average score trend dropped more than 20% vs prior 7 days.`,
            { prevAvg, lastAvg, className: c.name },
          );
          if (ok) created += 1;
          else skippedDuplicates += 1;
        }
      } catch {
        failedChecks += 1;
      }

      try {
        const prevAtt = await this.classAttendanceRateWindow(schoolId, c.id, prev7Start, last7Start);
        const lastAtt = await this.classAttendanceRateWindow(schoolId, c.id, last7Start, now);
        if (
          prevAtt != null &&
          lastAtt != null &&
          prevAtt > 0 &&
          (prevAtt - lastAtt) / prevAtt > 0.2
        ) {
          classAttendanceDrop += 1;
          const ok = await this.createAuto(
            schoolId,
            c.primaryTeacherId,
            c.id,
            null,
            "auto_class_attendance_drop",
            `Class attendance rate dropped more than 20% vs prior 7 days.`,
            { prevAtt, lastAtt },
          );
          if (ok) created += 1;
          else skippedDuplicates += 1;
        }
      } catch {
        failedChecks += 1;
      }
    }

    return {
      created,
      skippedDuplicates,
      failedChecks,
      riskClass,
      riskStudent,
      attendanceDrop,
      engagementDrop,
      classScoreDrop,
      classAttendanceDrop,
    };
  }

  private async classAttendanceRateWindow(
    schoolId: string,
    classId: string,
    from: Date,
    toExclusive: Date,
  ): Promise<number | null> {
    const rows = await this.prisma.attendanceRecord.findMany({
      where: {
        schoolId,
        classId,
        deletedAt: null,
        sessionDate: { gte: from, lt: toExclusive },
      },
      select: { status: true },
    });
    if (!rows.length) return null;
    const present = rows.filter((r) => PRESENT_LIKE.has(r.status)).length;
    return present / rows.length;
  }
}
