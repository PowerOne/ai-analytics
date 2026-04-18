import { Module } from "@nestjs/common";
import { AnalyticsModule } from "../analytics/analytics.module";
import { InsightsModule } from "../insights/insights.module";
import { RiskModule } from "../risk/risk.module";
import { TeacherAnalyticsController } from "./teacher-analytics.controller";
import { TeacherAnalyticsService } from "./teacher-analytics.service";

@Module({
  imports: [AnalyticsModule, RiskModule, InsightsModule],
  controllers: [TeacherAnalyticsController],
  providers: [TeacherAnalyticsService],
  exports: [TeacherAnalyticsService],
})
export class TeacherAnalyticsModule {}
