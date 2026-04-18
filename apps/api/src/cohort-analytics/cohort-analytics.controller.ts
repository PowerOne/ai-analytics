import { Controller, Get, NotFoundException, Param, UseGuards } from "@nestjs/common";
import { UserRole } from "../common/user-role";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { SchoolParamGuard } from "../common/guards/school-param.guard";
import type { JwtPayload } from "../common/types/jwt-payload";
import { CohortAnalyticsService } from "./cohort-analytics.service";

@Controller("schools/:schoolId")
@UseGuards(JwtAuthGuard, RolesGuard, SchoolParamGuard)
@Roles(UserRole.ADMIN, UserRole.PRINCIPAL)
export class CohortAnalyticsController {
  constructor(private readonly cohortAnalytics: CohortAnalyticsService) {}

  @Get("cohorts/grades")
  listGrades(@Param("schoolId") schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.cohortAnalytics.listGradeCohorts(schoolId, user);
  }

  @Get("cohorts/subjects")
  listSubjects(@Param("schoolId") schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.cohortAnalytics.listSubjectCohorts(schoolId, user);
  }

  @Get("cohorts/grades/:gradeId")
  async getGrade(
    @Param("schoolId") schoolId: string,
    @Param("gradeId") gradeId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.cohortAnalytics.getGradeCohort(schoolId, gradeId, user);
  }

  @Get("cohorts/subjects/:subjectId")
  async getSubject(
    @Param("schoolId") schoolId: string,
    @Param("subjectId") subjectId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const row = await this.cohortAnalytics.getSubjectCohort(schoolId, subjectId, user);
    if (!row) throw new NotFoundException("Subject cohort not found");
    return row;
  }
}
