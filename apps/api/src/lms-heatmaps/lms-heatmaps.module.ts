import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../prisma/prisma.module";
import { LmsHeatmapsController } from "./lms-heatmaps.controller";
import { LmsHeatmapsService } from "./lms-heatmaps.service";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    HttpModule.register({
      timeout: 60_000,
      maxRedirects: 0,
    }),
  ],
  controllers: [LmsHeatmapsController],
  providers: [LmsHeatmapsService],
  exports: [LmsHeatmapsService],
})
export class LmsHeatmapsModule {}
