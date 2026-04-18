import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AnalyticsModule } from "../analytics/analytics.module";
import { RiskModule } from "../risk/risk.module";
import { CohortAnalyticsController } from "./cohort-analytics.controller";
import { CohortAnalyticsService } from "./cohort-analytics.service";

@Module({
  imports: [
    ConfigModule,
    AnalyticsModule,
    RiskModule,
    HttpModule.register({
      timeout: 60_000,
      maxRedirects: 0,
    }),
  ],
  controllers: [CohortAnalyticsController],
  providers: [CohortAnalyticsService],
  exports: [CohortAnalyticsService],
})
export class CohortAnalyticsModule {}
