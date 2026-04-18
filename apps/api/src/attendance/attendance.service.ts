import { Injectable } from "@nestjs/common";
import type { RowDataPacket } from "mysql2/promise";
import { MySQLService } from "../database/mysql.service";
import type { JwtPayload } from "../common/types/jwt-payload";

type AttendanceListRow = RowDataPacket & {
  id: string;
  sessionDate: Date;
  sessionIndex: number;
  status: string;
  class_id: string;
  class_name: string;
  student_id: string;
  student_displayName: string | null;
  student_familyName: string | null;
  student_givenName: string | null;
};

@Injectable()
export class AttendanceService {
  constructor(private readonly db: MySQLService) {}

  async findAll(user: JwtPayload, query: { classId?: string; from?: string; to?: string }) {
    const params: unknown[] = [user.schoolId];
    let sql = `
      SELECT ar.id,
             ar.session_date AS sessionDate,
             ar.session_index AS sessionIndex,
             ar.status,
             c.id AS class_id,
             c.name AS class_name,
             s.id AS student_id,
             s.display_name AS student_displayName,
             s.family_name AS student_familyName,
             s.given_name AS student_givenName
      FROM attendance_records ar
      INNER JOIN classes c ON c.id = ar.class_id AND c.deleted_at IS NULL
      INNER JOIN students s ON s.id = ar.student_id AND s.deleted_at IS NULL
      WHERE ar.school_id = ?
        AND ar.deleted_at IS NULL
    `;

    if (user.role === "TEACHER" && user.teacherId) {
      sql += ` AND c.primary_teacher_id = ?`;
      params.push(user.teacherId);
    }
    if (query.classId) {
      sql += ` AND ar.class_id = ?`;
      params.push(query.classId);
    }
    if (query.from) {
      sql += ` AND ar.session_date >= ?`;
      params.push(query.from);
    }
    if (query.to) {
      sql += ` AND ar.session_date <= ?`;
      params.push(query.to);
    }

    sql += ` ORDER BY ar.session_date DESC LIMIT 500`;

    const rows = (await this.db.query(sql, params))[0] as AttendanceListRow[];

    return rows.map((r) => ({
      id: r.id,
      sessionDate: r.sessionDate,
      sessionIndex: r.sessionIndex,
      status: r.status,
      class: { id: r.class_id, name: r.class_name },
      student: {
        id: r.student_id,
        displayName: r.student_displayName,
        familyName: r.student_familyName,
        givenName: r.student_givenName,
      },
    }));
  }
}
