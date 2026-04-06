import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { SchoolParamGuard } from "../common/guards/school-param.guard";
import type { JwtPayload } from "../common/types/jwt-payload";
import { TeacherAnalyticsService } from "./teacher-analytics.service";

@Controller("schools/:schoolId")
@UseGuards(JwtAuthGuard, RolesGuard, SchoolParamGuard)
@Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER)
export class TeacherAnalyticsController {
  constructor(private readonly teacherAnalytics: TeacherAnalyticsService) {}

  @Get("teachers/:teacherId/classes/:classId/analytics")
  getTeacherClassDashboard(
    @Param("schoolId") schoolId: string,
    @Param("teacherId") teacherId: string,
    @Param("classId") classId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.teacherAnalytics.getTeacherClassDashboard(teacherId, classId, schoolId, user);
  }

  @Get("teachers/:teacherId/students/:studentId/analytics")
  getTeacherStudentDashboard(
    @Param("schoolId") schoolId: string,
    @Param("teacherId") teacherId: string,
    @Param("studentId") studentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.teacherAnalytics.getTeacherStudentDashboard(teacherId, studentId, schoolId, user);
  }

  @Get("teachers/:teacherId/analytics")
  getTeacherDashboard(
    @Param("schoolId") schoolId: string,
    @Param("teacherId") teacherId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.teacherAnalytics.getTeacherDashboard(teacherId, schoolId, user);
  }
}
