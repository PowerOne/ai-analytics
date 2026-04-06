import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AnalyticsModule } from "../analytics/analytics.module";
import { LmsHeatmapsModule } from "../lms-heatmaps/lms-heatmaps.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RiskModule } from "../risk/risk.module";
import { WeeklyReportsController } from "./weekly-reports.controller";
import { WeeklyReportsService } from "./weekly-reports.service";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AnalyticsModule,
    RiskModule,
    LmsHeatmapsModule,
    HttpModule.register({
      timeout: 60_000,
      maxRedirects: 0,
    }),
  ],
  controllers: [WeeklyReportsController],
  providers: [WeeklyReportsService],
  exports: [WeeklyReportsService],
})
export class WeeklyReportsModule {}
