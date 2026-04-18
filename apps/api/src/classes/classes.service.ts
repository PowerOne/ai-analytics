import { Injectable } from "@nestjs/common";
import type { RowDataPacket } from "mysql2/promise";
import { MySQLService } from "../database/mysql.service";
import type { JwtPayload } from "../common/types/jwt-payload";

type ClassListRow = RowDataPacket & {
  id: string;
  name: string;
  sectionCode: string | null;
  room: string | null;
  subject_code: string;
  subject_name: string;
  term_label: string;
  pt_id: string | null;
  pt_displayName: string | null;
  pt_email: string | null;
};

@Injectable()
export class ClassesService {
  constructor(private readonly db: MySQLService) {}

  async findAll(user: JwtPayload) {
    const params: unknown[] = [user.schoolId];
    let teacherClause = "";
    if (user.role === "TEACHER" && user.teacherId) {
      teacherClause = " AND c.primary_teacher_id = ?";
      params.push(user.teacherId);
    }

    const sql = `
      SELECT c.id,
             c.name,
             c.section_code AS sectionCode,
             c.room,
             sub.code AS subject_code,
             sub.name AS subject_name,
             t.label AS term_label,
             pt.id AS pt_id,
             pt.display_name AS pt_displayName,
             pt.email AS pt_email
      FROM classes c
      INNER JOIN subjects sub ON sub.id = c.subject_id AND sub.deleted_at IS NULL
      INNER JOIN terms t ON t.id = c.term_id AND t.deleted_at IS NULL
      LEFT JOIN teachers pt ON pt.id = c.primary_teacher_id AND pt.deleted_at IS NULL
      WHERE c.school_id = ? AND c.deleted_at IS NULL
      ${teacherClause}
      ORDER BY c.name ASC
    `;

    const rows = (await this.db.query(sql, params))[0] as ClassListRow[];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      sectionCode: r.sectionCode,
      room: r.room,
      subject: { code: r.subject_code, name: r.subject_name },
      term: { label: r.term_label },
      primaryTeacher: r.pt_id
        ? {
            id: r.pt_id,
            displayName: r.pt_displayName,
            email: r.pt_email,
          }
        : null,
    }));
  }
}
