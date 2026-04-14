import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { SchoolParamGuard } from "../common/guards/school-param.guard";
import { TeachersService } from "./teachers.service";

@Controller("schools/:schoolId")
@UseGuards(JwtAuthGuard, RolesGuard, SchoolParamGuard)
@Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER)
export class TeachersController {
  constructor(private readonly teachers: TeachersService) {}

  @Get("teachers")
  list(@Param("schoolId") schoolId: string) {
    return this.teachers.listForSchool(schoolId);
  }
}
