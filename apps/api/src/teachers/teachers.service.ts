import { Injectable } from "@nestjs/common";
import type { RowDataPacket } from "mysql2/promise";
import { MySQLService } from "../database/mysql.service";

type TeacherListRow = RowDataPacket & {
  id: string;
  displayName: string | null;
  givenName: string | null;
  familyName: string | null;
  email: string | null;
  createdAt: Date;
};

@Injectable()
export class TeachersService {
  constructor(private readonly db: MySQLService) {}

  async listForSchool(schoolId: string) {
    const rows = (
      await this.db.query(
        `SELECT id,
                display_name AS displayName,
                given_name AS givenName,
                family_name AS familyName,
                email,
                created_at AS createdAt
         FROM teachers
         WHERE school_id = ? AND deleted_at IS NULL
         ORDER BY display_name ASC, family_name ASC, given_name ASC`,
        [schoolId],
      )
    )[0] as TeacherListRow[];
    return rows;
  }
}
