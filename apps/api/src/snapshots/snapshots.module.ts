import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AnalyticsModule } from "../analytics/analytics.module";
import { CohortAnalyticsModule } from "../cohort-analytics/cohort-analytics.module";
import { InterventionsModule } from "../interventions/interventions.module";
import { LmsHeatmapsModule } from "../lms-heatmaps/lms-heatmaps.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RiskModule } from "../risk/risk.module";
import { SnapshotsProcessor } from "./snapshots.processor";
import { SnapshotsService } from "./snapshots.service";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AnalyticsModule,
    RiskModule,
    InterventionsModule,
    CohortAnalyticsModule,
    LmsHeatmapsModule,
  ],
  providers: [SnapshotsService, SnapshotsProcessor],
})
export class SnapshotsModule {}
