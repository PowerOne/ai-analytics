import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { SchoolParamGuard } from "../common/guards/school-param.guard";
import type { JwtPayload } from "../common/types/jwt-payload";
import { WeeklyReportsService } from "./weekly-reports.service";

@Controller("schools/:schoolId")
@UseGuards(JwtAuthGuard, RolesGuard, SchoolParamGuard)
@Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER)
export class WeeklyReportsController {
  constructor(private readonly weeklyReports: WeeklyReportsService) {}

  @Post("teachers/:teacherId/weekly-report/generate")
  generate(
    @Param("schoolId") schoolId: string,
    @Param("teacherId") teacherId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.weeklyReports.generateWeeklyReport(schoolId, teacherId, user);
  }

  @Get("teachers/:teacherId/weekly-report")
  getReport(
    @Param("schoolId") schoolId: string,
    @Param("teacherId") teacherId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.weeklyReports.getWeeklyReport(schoolId, teacherId, user);
  }
}
