import { Module } from "@nestjs/common";
import { AnalyticsModule } from "../analytics/analytics.module";
import { RiskController } from "./risk.controller";
import { RiskService } from "./risk.service";

@Module({
  imports: [AnalyticsModule],
  controllers: [RiskController],
  providers: [RiskService],
  exports: [RiskService],
})
export class RiskModule {}
