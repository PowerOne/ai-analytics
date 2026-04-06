import { HttpService } from "@nestjs/axios";
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { AxiosError } from "axios";
import { firstValueFrom } from "rxjs";
import type { JwtPayload } from "../common/types/jwt-payload";
import { scopeClasses, scopeStudents } from "../common/tenant-scope";
import { PrismaService } from "../prisma/prisma.service";
import type { HeatmapCell } from "./dto/heatmap-cell.dto";
import type { ClassHeatmapResponse } from "./dto/class-heatmap.dto";
import type { GradeHeatmapResponse } from "./dto/grade-heatmap.dto";
import type { SchoolHeatmapResponse } from "./dto/school-heatmap.dto";
import type { StudentHeatmapResponse } from "./dto/student-heatmap.dto";
import type { SubjectHeatmapResponse } from "./dto/subject-heatmap.dto";

function toUtcYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Monday UTC of the ISO week containing `d`. */
function weekStartKey(d: Date): string {
  const x = new Date(d);
  const day = x.getUTCDay();
  const diff = (day + 6) % 7;
  x.setUTCDate(x.getUTCDate() - diff);
  x.setUTCHours(0, 0, 0, 0);
  return toUtcYmd(x);
}

function monthStartKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function normalizeGradeKey(gradeLevel: string | null | undefined): string {
  const g = (gradeLevel ?? "").trim();
  return g.length ? g : "_unassigned";
}

function teacherLmsWhere(user: JwtPayload): Prisma.LmsActivityEventWhereInput | undefined {
  if (user.role !== UserRole.TEACHER || !user.teacherId) return undefined;
  return {
    OR: [
      {
        classId: null,
        student: {
          enrollments: {
            some: {
              deletedAt: null,
              class: { primaryTeacherId: user.teacherId, deletedAt: null },
            },
          },
        },
      },
      { class: { primaryTeacherId: user.teacherId, deletedAt: null } },
    ],
  };
}

function mergeTeacherScope(
  base: Prisma.LmsActivityEventWhereInput,
  user: JwtPayload,
): Prisma.LmsActivityEventWhereInput {
  const t = teacherLmsWhere(user);
  if (!t) return base;
  return { AND: [base, t] };
}

function defaultDateRange(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 365);
  return { from, to };
}

function parseOptionalDate(s: string | undefined): Date | undefined {
  if (!s?.trim()) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

@Injectable()
export class LmsHeatmapsService {
  private readonly logger = new Logger(LmsHeatmapsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private getAiBaseUrl(): string {
    return (this.config.get<string>("AI_SERVICE_URL") ?? "http://ai:8000").replace(/\/$/, "");
  }

  private async tryAiSummary(payload: Record<string, unknown>): Promise<string | null> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ summary?: string }>(`${this.getAiBaseUrl()}/generate-lms-heatmap-summary`, payload, {
          headers: { "Content-Type": "application/json" },
          timeout: this.config.get<number>("AI_SERVICE_TIMEOUT_MS") ?? 60_000,
        }),
      );
      const s = res.data?.summary;
      return typeof s === "string" ? s : null;
    } catch (err) {
      if (err instanceof AxiosError) {
        this.logger.warn(`LMS heatmap AI failed: ${err.response?.status ?? err.code}`);
      } else {
        this.logger.warn(`LMS heatmap AI failed: ${err instanceof Error ? err.message : err}`);
      }
      return null;
    }
  }

  private buildBuckets(
    events: { occurredAt: Date; eventType: string }[],
    mode: "day" | "week" | "month",
  ): HeatmapCell[] {
    const map = new Map<string, { count: number; eventTypes: Record<string, number> }>();
    for (const e of events) {
      const key =
        mode === "day"
          ? toUtcYmd(e.occurredAt)
          : mode === "week"
            ? weekStartKey(e.occurredAt)
            : monthStartKey(e.occurredAt);
      const cur = map.get(key) ?? { count: 0, eventTypes: {} };
      cur.count += 1;
      cur.eventTypes[e.eventType] = (cur.eventTypes[e.eventType] ?? 0) + 1;
      map.set(key, cur);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, count: v.count, eventTypes: v.eventTypes }));
  }

  private async fetchEvents(where: Prisma.LmsActivityEventWhereInput): Promise<
    { occurredAt: Date; eventType: string }[]
  > {
    return this.prisma.lmsActivityEvent.findMany({
      where: { ...where, deletedAt: null },
      select: { occurredAt: true, eventType: true },
    });
  }

  private async teacherStudentIdSet(user: JwtPayload): Promise<Set<string> | null> {
    if (user.role !== UserRole.TEACHER || !user.teacherId) return null;
    const rows = await this.prisma.enrollment.findMany({
      where: {
        schoolId: user.schoolId,
        deletedAt: null,
        status: "active",
        class: { primaryTeacherId: user.teacherId, deletedAt: null },
      },
      select: { studentId: true },
      distinct: ["studentId"],
    });
    return new Set(rows.map((r) => r.studentId));
  }

  async getStudentHeatmap(
    schoolId: string,
    studentId: string,
    user: JwtPayload,
    from?: string,
    to?: string,
  ): Promise<StudentHeatmapResponse> {
    const st = await this.prisma.student.findFirst({
      where: { id: studentId, ...scopeStudents(user) },
    });
    if (!st) throw new NotFoundException("Student not found");

    const { from: f0, to: t0 } = defaultDateRange();
    const f = parseOptionalDate(from) ?? f0;
    const t = parseOptionalDate(to) ?? t0;

    let base: Prisma.LmsActivityEventWhereInput = {
      schoolId,
      studentId,
      occurredAt: { gte: f, lte: t },
    };
    base = mergeTeacherScope(base, user);

    const events = await this.fetchEvents(base);
    const heatmap = this.buildBuckets(events, "day");
    const weekly = this.buildBuckets(events, "week");
    const monthly = this.buildBuckets(events, "month");

    const aiSummary = await this.tryAiSummary({
      scope: "student",
      schoolId,
      studentId,
      daily: heatmap,
      weekly,
      monthly,
    });

    return { studentId, heatmap, weekly, monthly, aiSummary };
  }

  async getClassHeatmap(
    schoolId: string,
    classId: string,
    user: JwtPayload,
    from?: string,
    to?: string,
  ): Promise<ClassHeatmapResponse> {
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, ...scopeClasses(user) },
    });
    if (!cls) throw new NotFoundException("Class not found");

    const { from: f0, to: t0 } = defaultDateRange();
    const f = parseOptionalDate(from) ?? f0;
    const t = parseOptionalDate(to) ?? t0;

    let base: Prisma.LmsActivityEventWhereInput = {
      schoolId,
      classId,
      occurredAt: { gte: f, lte: t },
    };
    base = mergeTeacherScope(base, user);

    const events = await this.fetchEvents(base);
    const heatmap = this.buildBuckets(events, "day");
    const weekly = this.buildBuckets(events, "week");
    const monthly = this.buildBuckets(events, "month");

    const aiSummary = await this.tryAiSummary({
      scope: "class",
      schoolId,
      classId,
      daily: heatmap,
      weekly,
      monthly,
    });

    return { classId, heatmap, weekly, monthly, aiSummary };
  }

  async getGradeHeatmap(
    schoolId: string,
    gradeId: string,
    user: JwtPayload,
    from?: string,
    to?: string,
  ): Promise<GradeHeatmapResponse> {
    const key = decodeURIComponent(gradeId);
    const students = await this.prisma.student.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true, gradeLevel: true },
    });
    let studentIds = students.filter((s) => normalizeGradeKey(s.gradeLevel) === key).map((s) => s.id);

    const allowed = await this.teacherStudentIdSet(user);
    if (allowed) {
      studentIds = studentIds.filter((id) => allowed.has(id));
    }

    if (!studentIds.length) {
      return {
        gradeId: key,
        heatmap: [],
        weekly: [],
        monthly: [],
        aiSummary: null,
      };
    }

    const { from: f0, to: t0 } = defaultDateRange();
    const f = parseOptionalDate(from) ?? f0;
    const t = parseOptionalDate(to) ?? t0;

    let base: Prisma.LmsActivityEventWhereInput = {
      schoolId,
      studentId: { in: studentIds },
      occurredAt: { gte: f, lte: t },
    };
    base = mergeTeacherScope(base, user);

    const events = await this.fetchEvents(base);
    const heatmap = this.buildBuckets(events, "day");
    const weekly = this.buildBuckets(events, "week");
    const monthly = this.buildBuckets(events, "month");

    const aiSummary = await this.tryAiSummary({
      scope: "grade",
      schoolId,
      gradeId: key,
      daily: heatmap,
      weekly,
      monthly,
    });

    return { gradeId: key, heatmap, weekly, monthly, aiSummary };
  }

  async getSubjectHeatmap(
    schoolId: string,
    subjectId: string,
    user: JwtPayload,
    from?: string,
    to?: string,
  ): Promise<SubjectHeatmapResponse> {
    const sub = await this.prisma.subject.findFirst({
      where: { id: subjectId, schoolId, deletedAt: null },
    });
    if (!sub) throw new NotFoundException("Subject not found");

    let classFilter: Prisma.ClassWhereInput = { schoolId, subjectId, deletedAt: null };
    if (user.role === UserRole.TEACHER && user.teacherId) {
      classFilter = { ...classFilter, primaryTeacherId: user.teacherId };
    }

    const classes = await this.prisma.class.findMany({
      where: classFilter,
      select: { id: true },
    });
    const classIds = classes.map((c) => c.id);

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        schoolId,
        deletedAt: null,
        status: "active",
        classId: { in: classIds },
      },
      select: { studentId: true },
      distinct: ["studentId"],
    });
    const enrolledStudentIds = enrollments.map((e) => e.studentId);

    const { from: f0, to: t0 } = defaultDateRange();
    const f = parseOptionalDate(from) ?? f0;
    const t = parseOptionalDate(to) ?? t0;

    let base: Prisma.LmsActivityEventWhereInput = {
      schoolId,
      occurredAt: { gte: f, lte: t },
      OR: [
        ...(classIds.length ? [{ classId: { in: classIds } }] : []),
        ...(enrolledStudentIds.length
          ? [{ classId: null, studentId: { in: enrolledStudentIds } }]
          : []),
      ],
    };

    if (!classIds.length && !enrolledStudentIds.length) {
      return {
        subjectId,
        heatmap: [],
        weekly: [],
        monthly: [],
        aiSummary: null,
      };
    }

    base = mergeTeacherScope(base, user);

    const events = await this.fetchEvents(base);
    const heatmap = this.buildBuckets(events, "day");
    const weekly = this.buildBuckets(events, "week");
    const monthly = this.buildBuckets(events, "month");

    const aiSummary = await this.tryAiSummary({
      scope: "subject",
      schoolId,
      subjectId,
      daily: heatmap,
      weekly,
      monthly,
    });

    return { subjectId, heatmap, weekly, monthly, aiSummary };
  }

  async getSchoolHeatmap(
    schoolId: string,
    user: JwtPayload,
    from?: string,
    to?: string,
  ): Promise<SchoolHeatmapResponse> {
    if (user.schoolId !== schoolId) {
      throw new ForbiddenException("School mismatch");
    }

    const { from: f0, to: t0 } = defaultDateRange();
    const f = parseOptionalDate(from) ?? f0;
    const t = parseOptionalDate(to) ?? t0;

    let base: Prisma.LmsActivityEventWhereInput = {
      schoolId,
      occurredAt: { gte: f, lte: t },
    };
    base = mergeTeacherScope(base, user);

    const events = await this.fetchEvents(base);
    const heatmap = this.buildBuckets(events, "day");
    const weekly = this.buildBuckets(events, "week");
    const monthly = this.buildBuckets(events, "month");

    const aiSummary = await this.tryAiSummary({
      scope: "school",
      schoolId,
      daily: heatmap,
      weekly,
      monthly,
    });

    return { schoolId, heatmap, weekly, monthly, aiSummary };
  }
}
