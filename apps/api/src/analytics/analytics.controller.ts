import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { SchoolParamGuard } from "../common/guards/school-param.guard";
import type { JwtPayload } from "../common/types/jwt-payload";
import { AnalyticsService } from "./analytics.service";

@Controller("schools/:schoolId")
@UseGuards(JwtAuthGuard, RolesGuard, SchoolParamGuard)
@Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("classes/:classId/analytics")
  getClassAnalytics(
    @Param("schoolId") _schoolId: string,
    @Param("classId") classId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.analytics.getClassAnalytics(classId, user);
  }

  @Get("students/:studentId/analytics")
  getStudentAnalytics(
    @Param("schoolId") _schoolId: string,
    @Param("studentId") studentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.analytics.getStudentAnalytics(studentId, user);
  }
}
