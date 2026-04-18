import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AnalyticsModule } from "../analytics/analytics.module";
import { IntelligenceModule } from "../intelligence/intelligence.module";
import { InterventionsModule } from "../interventions/interventions.module";
import { LmsHeatmapsModule } from "../lms-heatmaps/lms-heatmaps.module";
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
    AnalyticsModule,
    RiskModule,
    InterventionsModule,
    IntelligenceModule,
    LmsHeatmapsModule,
  ],
  controllers: [PrincipalReportsController],
  providers: [PrincipalReportsService, PrincipalReportsProcessor],
  exports: [PrincipalReportsService],
})
export class PrincipalReportsModule {}
