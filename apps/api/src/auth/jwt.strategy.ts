import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { RowDataPacket } from "mysql2/promise";
import type { UserRole } from "../common/user-role";
import { MySQLService } from "../database/mysql.service";
import type { JwtPayload } from "../common/types/jwt-payload";

type UserJwtRow = RowDataPacket & {
  id: string;
  email: string;
  schoolId: string;
  role: UserRole;
  teacherId: string | null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    config: ConfigService,
    private readonly db: MySQLService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_SECRET"),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const sql = `
      SELECT id,
             email,
             school_id AS schoolId,
             role,
             teacher_id AS teacherId
      FROM users
      WHERE id = ? AND school_id = ?
      LIMIT 1
    `;
    const rows = (await this.db.query(sql, [payload.sub, payload.schoolId]))[0] as UserJwtRow[];
    const user = rows[0];
    if (!user) throw new UnauthorizedException();
    return {
      sub: user.id,
      email: user.email,
      schoolId: user.schoolId,
      role: user.role,
      teacherId: user.teacherId,
    };
  }
}
