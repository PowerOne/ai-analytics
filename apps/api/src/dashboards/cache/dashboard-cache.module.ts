import { CacheModule } from "@nestjs/cache-manager";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { redisStore } from "cache-manager-redis-yet";
import Redis from "ioredis";
import { DashboardCacheService } from "./dashboard-cache.service";

@Module({
  imports: [
    ConfigModule,
    CacheModule.registerAsync({
      isGlobal: false,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const url = config.get<string>("REDIS_URL") ?? "redis://127.0.0.1:6379";
        return {
          store: await redisStore({
            url,
          }),
        };
      },
    }),
  ],
  providers: [
    DashboardCacheService,
    {
      provide: "DASHBOARD_REDIS",
      useFactory: (config: ConfigService) =>
        new Redis(config.get<string>("REDIS_URL") ?? "redis://127.0.0.1:6379"),
      inject: [ConfigService],
    },
  ],
  exports: [DashboardCacheService],
})
export class DashboardCacheModule {}
