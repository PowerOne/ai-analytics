import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { SchoolParamGuard } from "../common/guards/school-param.guard";
import type { JwtPayload } from "../common/types/jwt-payload";
import { PrincipalReportResponse } from "./dto/principal-report.dto";
import { PrincipalReportsService } from "./principal-reports.service";

@ApiTags("principal-reports")
@Controller("schools/:schoolId")
@UseGuards(JwtAuthGuard, RolesGuard, SchoolParamGuard)
@Roles(UserRole.ADMIN, UserRole.PRINCIPAL)
export class PrincipalReportsController {
  constructor(private readonly principalReports: PrincipalReportsService) {}

  @Get("principal-report")
  @ApiOperation({ summary: "School-wide principal intelligence brief (weekly/monthly-style metrics)" })
  @ApiOkResponse({ type: PrincipalReportResponse })
  getReport(@Param("schoolId") schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.principalReports.getPrincipalReport(schoolId, user);
  }

  @Post("principal-report/generate")
  @ApiOperation({ summary: "Force regeneration of the principal report (no cache yet)" })
  @ApiOkResponse({ type: PrincipalReportResponse })
  generate(@Param("schoolId") schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.principalReports.getPrincipalReport(schoolId, user);
  }
}
