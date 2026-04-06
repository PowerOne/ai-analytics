import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AnalyticsService } from "../analytics/analytics.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { JwtPayload } from "../common/types/jwt-payload";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ClassesService } from "./classes.service";

@Controller("classes")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER)
export class ClassesController {
  constructor(
    private readonly classes: ClassesService,
    private readonly analytics: AnalyticsService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.classes.findAll(user);
  }

  @Get(":id/analytics")
  classAnalytics(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.analytics.getClassPerformanceSummary(id, user);
  }
}
