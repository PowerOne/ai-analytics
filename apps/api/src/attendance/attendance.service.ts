import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { JwtPayload } from "../common/types/jwt-payload";
import { scopeAttendance } from "../common/tenant-scope";

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: JwtPayload, query: { classId?: string; from?: string; to?: string }) {
    return this.prisma.attendanceRecord.findMany({
      where: {
        ...scopeAttendance(user),
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.from || query.to
          ? {
              sessionDate: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      take: 500,
      orderBy: { sessionDate: "desc" },
      select: {
        id: true,
        sessionDate: true,
        sessionIndex: true,
        status: true,
        class: { select: { id: true, name: true } },
        student: { select: { id: true, displayName: true, familyName: true, givenName: true } },
      },
    });
  }
}
