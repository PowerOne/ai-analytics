import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { JwtPayload } from "../common/types/jwt-payload";
import { scopeStudents } from "../common/tenant-scope";

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: JwtPayload) {
    return this.prisma.student.findMany({
      where: scopeStudents(user),
      orderBy: [{ familyName: "asc" }, { givenName: "asc" }],
      select: {
        id: true,
        externalId: true,
        givenName: true,
        familyName: true,
        displayName: true,
        email: true,
        gradeLevel: true,
        createdAt: true,
      },
    });
  }

  async ensureStudentInScope(studentId: string, user: JwtPayload) {
    const row = await this.prisma.student.findFirst({
      where: { id: studentId, ...scopeStudents(user) },
    });
    if (!row) throw new NotFoundException("Student not found");
    return row;
  }

  async assertStudentReadable(studentId: string, user: JwtPayload) {
    await this.ensureStudentInScope(studentId, user);
  }
}
