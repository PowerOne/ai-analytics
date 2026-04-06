import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { JwtPayload } from "../common/types/jwt-payload";
import { scopeAssessments } from "../common/tenant-scope";

@Injectable()
export class AssessmentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: JwtPayload) {
    return this.prisma.assessment.findMany({
      where: scopeAssessments(user),
      orderBy: { administeredOn: "desc" },
      select: {
        id: true,
        title: true,
        assessmentType: true,
        maxScore: true,
        administeredOn: true,
        class: { select: { id: true, name: true } },
      },
    });
  }
}
