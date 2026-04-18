import { Injectable } from "@nestjs/common";
import type { RowDataPacket } from "mysql2/promise";
import { MySQLService } from "../database/mysql.service";
import type { JwtPayload } from "../common/types/jwt-payload";

type AssessmentListRow = RowDataPacket & {
  id: string;
  title: string;
  assessmentType: string;
  maxScore: string | number | null;
  administeredOn: Date | null;
  class_id: string | null;
  class_name: string | null;
};

@Injectable()
export class AssessmentsService {
  constructor(private readonly db: MySQLService) {}

  async findAll(user: JwtPayload) {
    const isTeacher = user.role === "TEACHER" && user.teacherId;
    const params: unknown[] = isTeacher ? [user.teacherId, user.schoolId] : [user.schoolId];

    const join = isTeacher
      ? `INNER JOIN classes c ON c.id = a.class_id AND c.deleted_at IS NULL AND c.primary_teacher_id = ?`
      : `LEFT JOIN classes c ON c.id = a.class_id AND c.deleted_at IS NULL`;

    const sql = `
      SELECT a.id,
             a.title,
             a.assessment_type AS assessmentType,
             a.max_score AS maxScore,
             a.administered_on AS administeredOn,
             c.id AS class_id,
             c.name AS class_name
      FROM assessments a
      ${join}
      WHERE a.school_id = ? AND a.deleted_at IS NULL
      ORDER BY a.administered_on DESC
    `;

    const rows = (await this.db.query(sql, params))[0] as AssessmentListRow[];

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      assessmentType: r.assessmentType,
      maxScore: r.maxScore,
      administeredOn: r.administeredOn,
      class: r.class_id ? { id: r.class_id, name: r.class_name } : null,
    }));
  }
}
