import { Module, forwardRef } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AnalyticsModule } from "../analytics/analytics.module";
import { CohortAnalyticsModule } from "../cohort-analytics/cohort-analytics.module";
import { InsightsModule } from "../insights/insights.module";
import { IntelligenceModule } from "../intelligence/intelligence.module";
import { InterventionsModule } from "../interventions/interventions.module";
import { LmsHeatmapsModule } from "../lms-heatmaps/lms-heatmaps.module";
import { RiskModule } from "../risk/risk.module";
import { DashboardsController } from "./dashboards.controller";
import { DashboardsService } from "./dashboards.service";
import { PrincipalAttendanceEngagementHeatmapService } from "./principal-attendance-engagement-heatmap.service";

@Module({
  imports: [
    ConfigModule,
    AnalyticsModule,
    RiskModule,
    InterventionsModule,
    CohortAnalyticsModule,
    LmsHeatmapsModule,
    InsightsModule,
    forwardRef(() => IntelligenceModule),
  ],
  controllers: [DashboardsController],
  providers: [DashboardsService, PrincipalAttendanceEngagementHeatmapService],
  exports: [DashboardsService, PrincipalAttendanceEngagementHeatmapService],
})
export class DashboardsModule {}
