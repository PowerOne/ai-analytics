import { HttpModule } from "@nestjs/axios";
import { Module, forwardRef } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DashboardsModule } from "../dashboards/dashboards.module";
import { LmsHeatmapsModule } from "../lms-heatmaps/lms-heatmaps.module";
import { IntelligenceEngineService } from "./intelligence-engine.service";

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 60_000,
      maxRedirects: 0,
    }),
    LmsHeatmapsModule,
    forwardRef(() => DashboardsModule),
  ],
  providers: [IntelligenceEngineService],
  exports: [IntelligenceEngineService],
})
export class IntelligenceModule {}
