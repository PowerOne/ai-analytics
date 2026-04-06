import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AnalyticsModule } from "../analytics/analytics.module";
import { CohortAnalyticsModule } from "../cohort-analytics/cohort-analytics.module";
import { InsightsModule } from "../insights/insights.module";
import { InterventionsModule } from "../interventions/interventions.module";
import { LmsHeatmapsModule } from "../lms-heatmaps/lms-heatmaps.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RiskModule } from "../risk/risk.module";
import { DashboardsController } from "./dashboards.controller";
import { DashboardsService } from "./dashboards.service";

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 60_000,
      maxRedirects: 0,
    }),
    PrismaModule,
    AnalyticsModule,
    RiskModule,
    InterventionsModule,
    CohortAnalyticsModule,
    LmsHeatmapsModule,
    InsightsModule,
  ],
  controllers: [DashboardsController],
  providers: [DashboardsService],
  exports: [DashboardsService],
})
export class DashboardsModule {}
