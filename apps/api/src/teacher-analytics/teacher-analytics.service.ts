import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AnalyticsService } from "../analytics/analytics.service";
import type { JwtPayload } from "../common/types/jwt-payload";
import { InsightsService } from "../insights/insights.service";
import { PrismaService } from "../prisma/prisma.service";
import { RiskService } from "../risk/risk.service";
import type { ClassSummaryResponse } from "./dto/class-summary.dto";
import type { StudentSummaryResponse } from "./dto/student-summary.dto";
import type { TeacherDashboardResponse } from "./dto/teacher-dashboard.dto";

function studentDisplayName(s: {
  id: string;
  displayName: string | null;
  givenName: string | null;
  familyName: string | null;
}): string {
  return s.displayName ?? ([s.givenName, s.familyName].filter(Boolean).join(" ") || s.id);
}

@Injectable()
export class TeacherAnalyticsService {
  private readonly logger = new Logger(TeacherAnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly risk: RiskService,
    private readonly insights: InsightsService,
  ) {}

  private assertTeacherRoleAccess(teacherId: string, user: JwtPayload): void {
    if (user.role === UserRole.TEACHER && user.teacherId !== teacherId) {
      throw new ForbiddenException("Cannot access another teacher's analytics");
    }
  }

  private async ensureTeacherInSchool(teacherId: string, schoolId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, schoolId, deletedAt: null },
    });
    if (!teacher) throw new NotFoundException("Teacher not found");
    return teacher;
  }

  /** Swallows AI errors so dashboards still return analytics + risk. */
  private async tryInsights<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (err) {
      this.logger.warn(
        `Insights unavailable: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private async buildStudentSummary(
    schoolId: string,
    studentId: string,
    name: string,
    user: JwtPayload,
  ): Promise<StudentSummaryResponse> {
    const [analytics, risk, insights] = await Promise.all([
      this.analytics.getStudentAnalytics(studentId, user),
      this.risk.getStudentRisk(schoolId, studentId, user),
      this.tryInsights(() => this.insights.getStudentInsights(studentId, user)),
    ]);
    return {
      studentId,
      name,
      analytics,
      risk,
      insights,
    };
  }

  async buildClassSummary(
    schoolId: string,
    classId: string,
    className: string,
    user: JwtPayload,
    enrollmentRows: {
      studentId: string;
      student: {
        id: string;
        displayName: string | null;
        givenName: string | null;
        familyName: string | null;
      };
    }[],
  ): Promise<ClassSummaryResponse> {
    const [analytics, risk, insights] = await Promise.all([
      this.analytics.getClassAnalytics(classId, user),
      this.risk.getClassRisk(schoolId, classId, user),
      this.tryInsights(() => this.insights.getClassInsights(classId, user)),
    ]);

    const uniqueByStudent = new Map<string, (typeof enrollmentRows)[0]>();
    for (const row of enrollmentRows) {
      if (!uniqueByStudent.has(row.studentId)) uniqueByStudent.set(row.studentId, row);
    }

    const students = await Promise.all(
      [...uniqueByStudent.values()].map((row) =>
        this.buildStudentSummary(
          schoolId,
          row.studentId,
          studentDisplayName(row.student),
          user,
        ),
      ),
    );

    return {
      classId,
      name: className,
      analytics,
      risk,
      insights,
      students,
    };
  }

  async getTeacherDashboard(teacherId: string, schoolId: string, user: JwtPayload): Promise<TeacherDashboardResponse> {
    this.assertTeacherRoleAccess(teacherId, user);
    await this.ensureTeacherInSchool(teacherId, schoolId);

    const classes = await this.prisma.class.findMany({
      where: {
        schoolId,
        primaryTeacherId: teacherId,
        deletedAt: null,
      },
      orderBy: { name: "asc" },
      include: {
        enrollments: {
          where: { deletedAt: null, status: "active" },
          include: {
            student: {
              select: {
                id: true,
                displayName: true,
                givenName: true,
                familyName: true,
              },
            },
          },
        },
      },
    });

    const summaries = await Promise.all(
      classes.map((c) =>
        this.buildClassSummary(schoolId, c.id, c.name, user, c.enrollments),
      ),
    );

    return { teacherId, classes: summaries };
  }

  async getTeacherClassDashboard(
    teacherId: string,
    classId: string,
    schoolId: string,
    user: JwtPayload,
  ): Promise<ClassSummaryResponse> {
    this.assertTeacherRoleAccess(teacherId, user);
    await this.ensureTeacherInSchool(teacherId, schoolId);

    const cls = await this.prisma.class.findFirst({
      where: {
        id: classId,
        schoolId,
        primaryTeacherId: teacherId,
        deletedAt: null,
      },
      include: {
        enrollments: {
          where: { deletedAt: null, status: "active" },
          include: {
            student: {
              select: {
                id: true,
                displayName: true,
                givenName: true,
                familyName: true,
              },
            },
          },
        },
      },
    });

    if (!cls) throw new NotFoundException("Class not found for this teacher");

    return this.buildClassSummary(schoolId, cls.id, cls.name, user, cls.enrollments);
  }

  async getTeacherStudentDashboard(
    teacherId: string,
    studentId: string,
    schoolId: string,
    user: JwtPayload,
  ): Promise<StudentSummaryResponse> {
    this.assertTeacherRoleAccess(teacherId, user);
    await this.ensureTeacherInSchool(teacherId, schoolId);

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        schoolId,
        deletedAt: null,
        status: "active",
        class: {
          primaryTeacherId: teacherId,
          schoolId,
          deletedAt: null,
        },
      },
      include: {
        student: {
          select: {
            id: true,
            displayName: true,
            givenName: true,
            familyName: true,
          },
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException("Student not found in this teacher's classes");
    }

    return this.buildStudentSummary(
      schoolId,
      enrollment.studentId,
      studentDisplayName(enrollment.student),
      user,
    );
  }
}
