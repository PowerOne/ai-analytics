import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import type { Cache } from "cache-manager";
import Redis from "ioredis";

export type DashboardCacheType = "teacher" | "principal" | "cohort" | "student360";

/** TTL in seconds for each dashboard kind. */
export const DASHBOARD_CACHE_TTL_SECONDS = {
  teacher: 300,
  principal: 300,
  cohort: 600,
  student360: 120,
} as const;

@Injectable()
export class DashboardCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(DashboardCacheService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @Inject("DASHBOARD_REDIS") private readonly redis: Redis,
  ) {}

  onModuleDestroy(): void {
    void this.redis.quit();
  }

  /**
   * Key shape: `dashboards:{type}:{schoolId}` or `dashboards:{type}:{schoolId}:{entityId}`
   * (e.g. entityId = teacherId, encoded cohort key, studentId).
   */
  getCacheKey(type: DashboardCacheType, schoolId: string, entityId?: string): string {
    if (entityId != null && entityId !== "") {
      return `dashboards:${type}:${schoolId}:${entityId}`;
    }
    return `dashboards:${type}:${schoolId}`;
  }

  async get<T>(type: DashboardCacheType, schoolId: string, entityId?: string): Promise<T | null> {
    const key = this.getCacheKey(type, schoolId, entityId);
    const raw = await this.cache.get<string>(key);
    if (raw == null || raw === "") return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      this.logger.warn(`Invalid JSON in cache for key ${key}`);
      return null;
    }
  }

  async set<T>(
    type: DashboardCacheType,
    schoolId: string,
    entityId: string | undefined,
    value: T,
    ttlSeconds: number,
  ): Promise<void> {
    const key = this.getCacheKey(type, schoolId, entityId);
    await this.cache.set(key, JSON.stringify(value), ttlSeconds * 1000);
  }

  async clear(type: DashboardCacheType, schoolId: string, entityId?: string): Promise<void> {
    const key = this.getCacheKey(type, schoolId, entityId);
    await this.cache.del(key);
  }

  /**
   * Removes all dashboard cache entries for a school (any type / entity).
   */
  async clearSchool(schoolId: string): Promise<void> {
    const pattern = `dashboards:*:${schoolId}*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length) {
      await this.redis.del(...keys);
    }
  }
}
