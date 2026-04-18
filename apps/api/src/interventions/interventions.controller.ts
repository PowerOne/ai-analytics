import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "../common/user-role";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { SchoolParamGuard } from "../common/guards/school-param.guard";
import type { JwtPayload } from "../common/types/jwt-payload";
import { CreateInterventionDto } from "./dto/create-intervention.dto";
import { UpdateInterventionDto } from "./dto/update-intervention.dto";
import { InterventionsService } from "./interventions.service";

@Controller("schools/:schoolId")
@UseGuards(JwtAuthGuard, RolesGuard, SchoolParamGuard)
@Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER)
export class InterventionsController {
  constructor(private readonly interventions: InterventionsService) {}

  @Post("interventions/auto-check")
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL)
  runAutoCheck(@Param("schoolId") schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.interventions.autoCheck(schoolId, user);
  }

  @Post("interventions")
  create(
    @Param("schoolId") schoolId: string,
    @Body() dto: CreateInterventionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.interventions.createIntervention(schoolId, dto, user);
  }

  @Get("interventions")
  list(@Param("schoolId") schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.interventions.listInterventions(schoolId, user);
  }

  @Get("interventions/:id")
  getOne(@Param("schoolId") schoolId: string, @Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.interventions.getIntervention(schoolId, id, user);
  }

  @Patch("interventions/:id")
  update(
    @Param("schoolId") schoolId: string,
    @Param("id") id: string,
    @Body() dto: UpdateInterventionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.interventions.updateIntervention(schoolId, id, dto, user);
  }
}
