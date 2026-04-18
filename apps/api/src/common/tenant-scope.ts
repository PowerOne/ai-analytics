import { UserRole } from "./user-role";
import type { JwtPayload } from "./types/jwt-payload";

/**
 * Tenant-scoped filter helpers for raw SQL query building (types may be absent
 * when using raw SQL only). Safe to use if you bridge these into query builders.
 */
export type TenantWhereInput = Record<string, unknown>;

export function scopeStudents(user: JwtPayload): TenantWhereInput {
  const base: TenantWhereInput = { schoolId: user.schoolId, deletedAt: null };
  if (user.role === UserRole.TEACHER && user.teacherId) {
    return {
      ...base,
      enrollments: {
        some: {
          deletedAt: null,
          class: { primaryTeacherId: user.teacherId, deletedAt: null },
        },
      },
    };
  }
  return base;
}

export function scopeClasses(user: JwtPayload): TenantWhereInput {
  const base: TenantWhereInput = { schoolId: user.schoolId, deletedAt: null };
  if (user.role === UserRole.TEACHER && user.teacherId) {
    return { ...base, primaryTeacherId: user.teacherId };
  }
  return base;
}

export function scopeAssessments(user: JwtPayload): TenantWhereInput {
  const base: TenantWhereInput = { schoolId: user.schoolId, deletedAt: null };
  if (user.role === UserRole.TEACHER && user.teacherId) {
    return { ...base, class: { primaryTeacherId: user.teacherId, deletedAt: null } };
  }
  return base;
}

export function scopeAttendance(user: JwtPayload): TenantWhereInput {
  const base: TenantWhereInput = { schoolId: user.schoolId, deletedAt: null };
  if (user.role === UserRole.TEACHER && user.teacherId) {
    return { ...base, class: { primaryTeacherId: user.teacherId, deletedAt: null } };
  }
  return base;
}
