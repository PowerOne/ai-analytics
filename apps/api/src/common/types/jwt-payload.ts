import type { UserRole } from "@prisma/client";

export interface JwtPayload {
  sub: string;
  email: string;
  schoolId: string;
  role: UserRole;
  teacherId: string | null;
}
