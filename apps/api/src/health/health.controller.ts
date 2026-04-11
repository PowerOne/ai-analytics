import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness + DB readiness: returns 503 if the database is unreachable. */
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "up", database: "connected" };
    } catch {
      throw new ServiceUnavailableException({
        status: "unavailable",
        database: "disconnected",
      });
    }
  }
}
