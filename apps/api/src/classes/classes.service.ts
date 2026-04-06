import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { JwtPayload } from "../common/types/jwt-payload";
import { scopeClasses } from "../common/tenant-scope";

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: JwtPayload) {
    return this.prisma.class.findMany({
      where: scopeClasses(user),
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sectionCode: true,
        room: true,
        subject: { select: { code: true, name: true } },
        term: { select: { label: true } },
        primaryTeacher: { select: { id: true, displayName: true, email: true } },
      },
    });
  }
}
