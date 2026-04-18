import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { MySQLService } from "../database/mysql.service";

@Controller("health")
export class HealthController {
  constructor(private readonly db: MySQLService) {}

  /** Liveness + DB readiness: returns 503 if the database is unreachable. */
  @Get()
  async check() {
    try {
      await this.db.query("SELECT 1");
      return { status: "up", database: "connected" };
    } catch {
      throw new ServiceUnavailableException({
        status: "unavailable",
        database: "disconnected",
      });
    }
  }
}
