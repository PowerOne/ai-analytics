import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AnalyticsService } from "../analytics/analytics.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { JwtPayload } from "../common/types/jwt-payload";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { StudentsService } from "./students.service";

@Controller("students")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER)
export class StudentsController {
  constructor(
    private readonly students: StudentsService,
    private readonly analytics: AnalyticsService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.students.findAll(user);
  }

  @Get(":id/analytics")
  getAnalytics(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.analytics.getStudentAnalyticsSummary(id, user);
  }
}
