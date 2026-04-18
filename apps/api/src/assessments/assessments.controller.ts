import { Controller, Get, UseGuards } from "@nestjs/common";
import { UserRole } from "../common/user-role";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { JwtPayload } from "../common/types/jwt-payload";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AssessmentsService } from "./assessments.service";

@Controller("assessments")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER)
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.assessments.findAll(user);
  }
}
