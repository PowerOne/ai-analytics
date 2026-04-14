import type { UserRole } from "./roles";

export type AuthUser = {
  id: string;
  email: string;
  schoolId: string;
  role: UserRole;
  teacherId: string | null;
};

export class AuthError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
