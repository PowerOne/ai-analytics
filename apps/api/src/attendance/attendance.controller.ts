import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { JwtPayload } from "../common/types/jwt-payload";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AttendanceService } from "./attendance.service";

@Controller("attendance")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query("classId") classId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.attendance.findAll(user, { classId, from, to });
  }
}
