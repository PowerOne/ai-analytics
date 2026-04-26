import { Controller, Get, Param, Query, UseGuards, BadRequestException } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "../common/user-role";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { SchoolParamGuard } from "../common/guards/school-param.guard";
import type { JwtPayload } from "../common/types/jwt-payload";
import { DashboardsService } from "./dashboards.service";
import { Class360DashboardResponse } from "./dto/class360-dashboard.dto";
import { CohortDashboardResponse } from "./dto/cohort-dashboard.dto";
import { PrincipalDashboardResponse } from "./dto/principal-dashboard.dto";
import { PrincipalAttEngContributorsResponseDto } from "./dto/principal-attendance-engagement-heatmap.dto";
import { PrincipalAttEngContributorsQueryDto } from "./dto/principal-att-eng-contributors-query.dto";
import { Student360DashboardResponse } from "./dto/student360-dashboard.dto";
import { TeacherDashboardResponse } from "./dto/teacher-dashboard.dto";
import dayjs from "dayjs";

@ApiTags("dashboards")
@Controller("schools/:schoolId")
@UseGuards(JwtAuthGuard, RolesGuard, SchoolParamGuard)
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  @Get("dashboards/teacher/:teacherId")
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER)
  @ApiOperation({ summary: "Teacher dashboard: classes, snapshot deltas, attention, LMS heatmap" })
  @ApiOkResponse({ type: TeacherDashboardResponse })
  getTeacherDashboard(
    @Param("schoolId") schoolId: string,
    @Param("teacherId") teacherId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.dashboards.getTeacherDashboard(schoolId, teacherId, user);
  }

  @Get("dashboards/principal/attendance-engagement/contributors")
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL)
  @ApiOperation({
    summary:
      "Principal: students and classes contributing to an attendance or engagement heatmap bucket (drill-down)",
  })
  @ApiOkResponse({ type: PrincipalAttEngContributorsResponseDto })
  getPrincipalAttEngContributors(
    @Param("schoolId") schoolId: string,
    @Query() query: PrincipalAttEngContributorsQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.dashboards.getPrincipalAttEngContributors(schoolId, user, query);
  }

  @Get("dashboards/principal")
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL)
  @ApiOperation({ summary: "Principal dashboard: school snapshot trends, cohorts, interventions, heatmap" })
  @ApiOkResponse({ type: PrincipalDashboardResponse })
  getPrincipalDashboard(
    @Param("schoolId") schoolId: string,
    @CurrentUser() user: JwtPayload,
    @Query("from") fromQuery?: string,
    @Query("to") toQuery?: string,
  ) {
    const from = fromQuery ? dayjs(fromQuery) : dayjs().subtract(14, "days");
    const to = toQuery ? dayjs(toQuery) : dayjs();

    if (!from.isValid() || !to.isValid()) {
      throw new BadRequestException("Invalid date format. Use YYYY-MM-DD.");
    }

    if (from.isAfter(to)) {
      throw new BadRequestException('"from" must be before "to".');
    }

    return this.dashboards.getPrincipalDashboard(schoolId, user, {
      from: from.toDate(),
      to: to.toDate(),
    });
  }

  @Get("dashboards/cohorts/grades/:gradeId")
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL)
  @ApiOperation({ summary: "Grade cohort dashboard (weekly snapshots + LMS heatmap)" })
  @ApiOkResponse({ type: CohortDashboardResponse })
  getCohortGrade(
    @Param("schoolId") schoolId: string,
    @Param("gradeId") gradeId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.dashboards.getCohortGradeDashboard(schoolId, gradeId, user);
  }

  @Get("dashboards/cohorts/subjects/:subjectId")
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL)
  @ApiOperation({ summary: "Subject cohort dashboard (weekly snapshots + LMS heatmap)" })
  @ApiOkResponse({ type: CohortDashboardResponse })
  getCohortSubject(
    @Param("schoolId") schoolId: string,
    @Param("subjectId") subjectId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.dashboards.getCohortSubjectDashboard(schoolId, subjectId, user);
  }

  @Get("dashboards/students/:studentId")
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER)
  @ApiOperation({ summary: "Student 360: snapshot deltas, live analytics, risk, interventions, heatmap" })
  @ApiOkResponse({ type: Student360DashboardResponse })
  getStudent360(
    @Param("schoolId") schoolId: string,
    @Param("studentId") studentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.dashboards.getStudent360(schoolId, studentId, user);
  }

  @Get("dashboards/classes/:classId")
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER)
  @ApiOperation({ summary: "Class 360: roster, subject/term, analytics and risk summaries" })
  @ApiOkResponse({ type: Class360DashboardResponse })
  getClass360(
    @Param("schoolId") schoolId: string,
    @Param("classId") classId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.dashboards.getClass360(schoolId, classId, user);
  }
}
