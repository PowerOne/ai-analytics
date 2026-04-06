import { Module } from "@nestjs/common";
import { AnalyticsModule } from "../analytics/analytics.module";
import { ClassesController } from "./classes.controller";
import { ClassesService } from "./classes.service";

@Module({
  imports: [AnalyticsModule],
  controllers: [ClassesController],
  providers: [ClassesService],
})
export class ClassesModule {}
