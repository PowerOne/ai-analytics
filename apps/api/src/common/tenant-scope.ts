import { Prisma, UserRole } from "@prisma/client";
import type { JwtPayload } from "./types/jwt-payload";

export function scopeStudents(user: JwtPayload): Prisma.StudentWhereInput {
  const base: Prisma.StudentWhereInput = { schoolId: user.schoolId, deletedAt: null };
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

export function scopeClasses(user: JwtPayload): Prisma.ClassWhereInput {
  const base: Prisma.ClassWhereInput = { schoolId: user.schoolId, deletedAt: null };
  if (user.role === UserRole.TEACHER && user.teacherId) {
    return { ...base, primaryTeacherId: user.teacherId };
  }
  return base;
}

export function scopeAssessments(user: JwtPayload): Prisma.AssessmentWhereInput {
  const base: Prisma.AssessmentWhereInput = { schoolId: user.schoolId, deletedAt: null };
  if (user.role === UserRole.TEACHER && user.teacherId) {
    return { ...base, class: { primaryTeacherId: user.teacherId, deletedAt: null } };
  }
  return base;
}

export function scopeAttendance(user: JwtPayload): Prisma.AttendanceRecordWhereInput {
  const base: Prisma.AttendanceRecordWhereInput = { schoolId: user.schoolId, deletedAt: null };
  if (user.role === UserRole.TEACHER && user.teacherId) {
    return { ...base, class: { primaryTeacherId: user.teacherId, deletedAt: null } };
  }
  return base;
}
