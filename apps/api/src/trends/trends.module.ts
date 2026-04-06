import { Module } from "@nestjs/common";
import { AnalyticsModule } from "../analytics/analytics.module";
import { LmsHeatmapsModule } from "../lms-heatmaps/lms-heatmaps.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RiskModule } from "../risk/risk.module";
import { TrendService } from "./trends.service";

@Module({
  imports: [PrismaModule, AnalyticsModule, RiskModule, LmsHeatmapsModule],
  providers: [TrendService],
  exports: [TrendService],
})
export class TrendsModule {}
