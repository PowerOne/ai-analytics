import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  listForSchool(schoolId: string) {
    return this.prisma.teacher.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: [{ displayName: "asc" }, { familyName: "asc" }, { givenName: "asc" }],
      select: {
        id: true,
        displayName: true,
        givenName: true,
        familyName: true,
        email: true,
        createdAt: true,
      },
    });
  }
}
