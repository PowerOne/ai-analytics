import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AnalyticsModule } from "../analytics/analytics.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RiskModule } from "../risk/risk.module";
import { InterventionsController } from "./interventions.controller";
import { InterventionsService } from "./interventions.service";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AnalyticsModule,
    RiskModule,
    HttpModule.register({
      timeout: 60_000,
      maxRedirects: 0,
    }),
  ],
  controllers: [InterventionsController],
  providers: [InterventionsService],
  exports: [InterventionsService],
})
export class InterventionsModule {}
