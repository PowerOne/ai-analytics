import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { SchoolParamGuard } from "../common/guards/school-param.guard";
import type { JwtPayload } from "../common/types/jwt-payload";
import { InsightsService } from "./insights.service";

@Controller("schools/:schoolId")
@UseGuards(JwtAuthGuard, RolesGuard, SchoolParamGuard)
@Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER)
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get("classes/:classId/insights")
  getClassInsights(
    @Param("schoolId") _schoolId: string,
    @Param("classId") classId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.insights.getClassInsights(classId, user);
  }

  @Get("students/:studentId/insights")
  getStudentInsights(
    @Param("schoolId") _schoolId: string,
    @Param("studentId") studentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.insights.getStudentInsights(studentId, user);
  }
}
