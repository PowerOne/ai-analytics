import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { UserRole } from "../common/user-role";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { SchoolParamGuard } from "../common/guards/school-param.guard";
import type { JwtPayload } from "../common/types/jwt-payload";
import { LmsHeatmapsService } from "./lms-heatmaps.service";

@Controller("schools/:schoolId/lms/heatmaps")
@UseGuards(JwtAuthGuard, RolesGuard, SchoolParamGuard)
@Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER)
export class LmsHeatmapsController {
  constructor(private readonly lmsHeatmaps: LmsHeatmapsService) {}

  @Get("students/:studentId")
  getStudent(
    @Param("schoolId") schoolId: string,
    @Param("studentId") studentId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.lmsHeatmaps.getStudentHeatmap(schoolId, studentId, user, from, to);
  }

  @Get("classes/:classId")
  getClass(
    @Param("schoolId") schoolId: string,
    @Param("classId") classId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.lmsHeatmaps.getClassHeatmap(schoolId, classId, user, from, to);
  }

  @Get("grades/:gradeId")
  getGrade(
    @Param("schoolId") schoolId: string,
    @Param("gradeId") gradeId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.lmsHeatmaps.getGradeHeatmap(schoolId, gradeId, user, from, to);
  }

  @Get("subjects/:subjectId")
  getSubject(
    @Param("schoolId") schoolId: string,
    @Param("subjectId") subjectId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.lmsHeatmaps.getSubjectHeatmap(schoolId, subjectId, user, from, to);
  }

  @Get("school")
  getSchool(
    @Param("schoolId") schoolId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.lmsHeatmaps.getSchoolHeatmap(schoolId, user, from, to);
  }
}
