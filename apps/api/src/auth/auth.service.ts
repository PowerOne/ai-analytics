import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { RowDataPacket } from "mysql2/promise";
import { MySQLService } from "../database/mysql.service";
import type { JwtPayload } from "../common/types/jwt-payload";
import type { UserRole } from "../common/user-role";
import type { LoginDto } from "./dto/login.dto";

type UserAuthRow = RowDataPacket & {
  id: string;
  email: string;
  password_hash: string;   // now plain text
  school_id: string;
  role: UserRole;
  teacher_id: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly db: MySQLService,
    private readonly jwt: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const sql = `
      SELECT 
        id,
        email,
        password_hash,
        school_id,
        role,
        teacher_id
      FROM users
      WHERE email = ?
      LIMIT 1
    `;

    const rows = (await this.db.query(sql, [email]))[0] as UserAuthRow[];
    const user = rows[0];

    if (!user) return null;

    // PLAIN TEXT PASSWORD CHECK
    const ok = password === user.password_hash;
    if (!ok) return null;

    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      schoolId: user.school_id,
      role: user.role,
      teacherId: user.teacher_id,
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        schoolId: user.school_id,
        role: user.role,
        teacherId: user.teacher_id,
      },
    };
  }
}
