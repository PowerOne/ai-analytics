import type { UserRole } from "../user-role";

export interface JwtPayload {
  sub: string;
  email: string;
  schoolId: string;
  role: UserRole;
  teacherId: string | null;
}
