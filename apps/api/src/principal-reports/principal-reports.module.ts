import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AnalyticsModule } from "../analytics/analytics.module";
import { CohortAnalyticsModule } from "../cohort-analytics/cohort-analytics.module";
import { InterventionsModule } from "../interventions/interventions.module";
import { LmsHeatmapsModule } from "../lms-heatmaps/lms-heatmaps.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RiskModule } from "../risk/risk.module";
import { PrincipalReportsController } from "./principal-reports.controller";
import { PrincipalReportsProcessor } from "./principal-reports.processor";
import { PrincipalReportsService } from "./principal-reports.service";

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
  ],
  controllers: [PrincipalReportsController],
  providers: [PrincipalReportsService, PrincipalReportsProcessor],
  exports: [PrincipalReportsService],
})
export class PrincipalReportsModule {}
