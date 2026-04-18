import { Injectable, NotFoundException } from "@nestjs/common";
import type { RowDataPacket } from "mysql2/promise";
import { MySQLService } from "../database/mysql.service";
import type { JwtPayload } from "../common/types/jwt-payload";

type StudentListRow = RowDataPacket & {
  id: string;
  externalId: string | null;
  givenName: string | null;
  familyName: string | null;
  displayName: string | null;
  email: string | null;
  gradeLevel: string | null;
  createdAt: Date;
};

type StudentFullRow = RowDataPacket & {
  id: string;
  schoolId: string;
  externalSource: string | null;
  externalId: string | null;
  givenName: string | null;
  familyName: string | null;
  displayName: string | null;
  email: string | null;
  gradeLevel: string | null;
  cohortYear: number | null;
  demographics: unknown;
  metadata: unknown;
  performance: number | null;
  attendance: number | null;
  engagement: number | null;
  riskScore: number | null;
  deltas: unknown;
  tiers: unknown;
  flags: unknown;
  stability: number | null;
  classId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

function teacherEnrollmentExistsClause(user: JwtPayload, params: unknown[]): string {
  if (user.role === "TEACHER" && user.teacherId) {
    params.push(user.teacherId);
    return ` AND EXISTS (
      SELECT 1 FROM enrollments e
      INNER JOIN classes c ON c.id = e.class_id AND c.deleted_at IS NULL
      WHERE e.student_id = s.id AND e.school_id = s.school_id AND e.deleted_at IS NULL AND c.primary_teacher_id = ?
    )`;
  }
  return "";
}

@Injectable()
export class StudentsService {
  constructor(private readonly db: MySQLService) {}

  async findAll(user: JwtPayload) {
    const params: unknown[] = [user.schoolId];
    const teacherClause = teacherEnrollmentExistsClause(user, params);
    const sql = `
      SELECT s.id,
             s.external_id AS externalId,
             s.given_name AS givenName,
             s.family_name AS familyName,
             s.display_name AS displayName,
             s.email,
             s.grade_level AS gradeLevel,
             s.created_at AS createdAt
      FROM students s
      WHERE s.school_id = ? AND s.deleted_at IS NULL
      ${teacherClause}
      ORDER BY s.family_name ASC, s.given_name ASC
    `;
    const rows = (await this.db.query(sql, params))[0] as StudentListRow[];
    return rows;
  }

  async ensureStudentInScope(studentId: string, user: JwtPayload) {
    const params: unknown[] = [studentId, user.schoolId];
    const teacherClause = teacherEnrollmentExistsClause(user, params);
    const sql = `
      SELECT s.id,
             s.school_id AS schoolId,
             s.external_source AS externalSource,
             s.external_id AS externalId,
             s.given_name AS givenName,
             s.family_name AS familyName,
             s.display_name AS displayName,
             s.email,
             s.grade_level AS gradeLevel,
             s.cohort_year AS cohortYear,
             s.demographics,
             s.metadata,
             s.performance,
             s.attendance,
             s.engagement,
             s.risk_score AS riskScore,
             s.deltas,
             s.tiers,
             s.flags,
             s.stability,
             s.class_id AS classId,
             s.created_at AS createdAt,
             s.updated_at AS updatedAt,
             s.deleted_at AS deletedAt
      FROM students s
      WHERE s.id = ? AND s.school_id = ? AND s.deleted_at IS NULL
      ${teacherClause}
      LIMIT 1
    `;
    const rows = (await this.db.query(sql, params))[0] as StudentFullRow[];
    const row = rows[0];
    if (!row) throw new NotFoundException("Student not found");
    return row;
  }

  async assertStudentReadable(studentId: string, user: JwtPayload) {
    await this.ensureStudentInScope(studentId, user);
  }
}
