import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { UserRole } from "../common/user-role";
import type { RowDataPacket } from "mysql2/promise";
import { AnalyticsService } from "../analytics/analytics.service";
import type { JwtPayload } from "../common/types/jwt-payload";
import { InsightsService } from "../insights/insights.service";
import { MySQLService } from "../database/mysql.service";
import { RiskService } from "../risk/risk.service";
import type { ClassSummaryResponse } from "./dto/class-summary.dto";
import type { StudentSummaryResponse } from "./dto/student-summary.dto";
import type { TeacherDashboardResponse } from "./dto/teacher-dashboard.dto";

type TeacherRow = RowDataPacket & { id: string };
type ClassBasicRow = RowDataPacket & { id: string; name: string };
type EnrollmentStudentRow = RowDataPacket & {
  classId: string;
  studentId: string;
  student_pk: string;
  displayName: string | null;
  givenName: string | null;
  familyName: string | null;
};

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
    private readonly db: MySQLService,
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
    const sql = `
      SELECT id FROM teachers
      WHERE id = ? AND school_id = ? AND deleted_at IS NULL
      LIMIT 1
    `;
    const rows = (await this.db.query(sql, [teacherId, schoolId]))[0] as TeacherRow[];
    const teacher = rows[0];
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

  private async fetchEnrollmentsForTeacherClasses(
    schoolId: string,
    teacherId: string,
    classId?: string,
  ): Promise<EnrollmentStudentRow[]> {
    const params: unknown[] = [schoolId, schoolId, teacherId];
    let classFilter = "";
    if (classId !== undefined) {
      classFilter = " AND e.class_id = ?";
      params.push(classId);
    }
    const sql = `
      SELECT e.class_id AS classId,
             e.student_id AS studentId,
             s.id AS student_pk,
             s.display_name AS displayName,
             s.given_name AS givenName,
             s.family_name AS familyName
      FROM enrollments e
      INNER JOIN students s ON s.id = e.student_id AND s.deleted_at IS NULL
      INNER JOIN classes c ON c.id = e.class_id AND c.deleted_at IS NULL
      WHERE e.school_id = ?
        AND e.deleted_at IS NULL
        AND e.status = 'active'
        AND c.school_id = ?
        AND c.primary_teacher_id = ?
        ${classFilter}
    `;
    const rows = (await this.db.query(sql, params))[0] as EnrollmentStudentRow[];
    return rows;
  }

  private mapEnrollmentsByClassId(rows: EnrollmentStudentRow[]) {
    const map = new Map<
      string,
      { studentId: string; student: { id: string; displayName: string | null; givenName: string | null; familyName: string | null } }[]
    >();
    for (const r of rows) {
      const list = map.get(r.classId) ?? [];
      list.push({
        studentId: r.studentId,
        student: {
          id: r.student_pk,
          displayName: r.displayName,
          givenName: r.givenName,
          familyName: r.familyName,
        },
      });
      map.set(r.classId, list);
    }
    return map;
  }

  async getTeacherDashboard(teacherId: string, schoolId: string, user: JwtPayload): Promise<TeacherDashboardResponse> {
    this.assertTeacherRoleAccess(teacherId, user);
    await this.ensureTeacherInSchool(teacherId, schoolId);

    const classesSql = `
      SELECT id, name FROM classes
      WHERE school_id = ? AND primary_teacher_id = ? AND deleted_at IS NULL
      ORDER BY name ASC
    `;
    const classRows = (await this.db.query(classesSql, [schoolId, teacherId]))[0] as ClassBasicRow[];

    const enrollmentFlat = await this.fetchEnrollmentsForTeacherClasses(schoolId, teacherId);
    const enrollmentsByClass = this.mapEnrollmentsByClassId(enrollmentFlat);

    const classes = classRows.map((c) => ({
      id: c.id,
      name: c.name,
      enrollments: enrollmentsByClass.get(c.id) ?? [],
    }));

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

    const clsSql = `
      SELECT id, name FROM classes
      WHERE id = ? AND school_id = ? AND primary_teacher_id = ? AND deleted_at IS NULL
      LIMIT 1
    `;
    const classRows = (await this.db.query(clsSql, [classId, schoolId, teacherId]))[0] as ClassBasicRow[];
    const cls = classRows[0];

    if (!cls) throw new NotFoundException("Class not found for this teacher");

    const enrollmentFlat = await this.fetchEnrollmentsForTeacherClasses(schoolId, teacherId, classId);
    const enrollments = enrollmentFlat.map((r) => ({
      studentId: r.studentId,
      student: {
        id: r.student_pk,
        displayName: r.displayName,
        givenName: r.givenName,
        familyName: r.familyName,
      },
    }));

    return this.buildClassSummary(schoolId, cls.id, cls.name, user, enrollments);
  }

  async getTeacherStudentDashboard(
    teacherId: string,
    studentId: string,
    schoolId: string,
    user: JwtPayload,
  ): Promise<StudentSummaryResponse> {
    this.assertTeacherRoleAccess(teacherId, user);
    await this.ensureTeacherInSchool(teacherId, schoolId);

    const sql = `
      SELECT e.student_id AS studentId,
             s.id AS student_pk,
             s.display_name AS displayName,
             s.given_name AS givenName,
             s.family_name AS familyName
      FROM enrollments e
      INNER JOIN classes c ON c.id = e.class_id AND c.deleted_at IS NULL
      INNER JOIN students s ON s.id = e.student_id AND s.deleted_at IS NULL
      WHERE e.student_id = ?
        AND e.school_id = ?
        AND e.deleted_at IS NULL
        AND e.status = 'active'
        AND c.school_id = ?
        AND c.primary_teacher_id = ?
        AND c.deleted_at IS NULL
      LIMIT 1
    `;
    const rows = (await this.db.query(sql, [
      studentId,
      schoolId,
      schoolId,
      teacherId,
    ]))[0] as EnrollmentStudentRow[];
    const row = rows[0];

    if (!row) {
      throw new NotFoundException("Student not found in this teacher's classes");
    }

    return this.buildStudentSummary(
      schoolId,
      row.studentId,
      studentDisplayName({
        id: row.student_pk,
        displayName: row.displayName,
        givenName: row.givenName,
        familyName: row.familyName,
      }),
      user,
    );
  }
}
