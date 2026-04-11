import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { SnapshotsService } from "./snapshots.service";

@Injectable()
export class SnapshotsProcessor {
  constructor(private readonly snapshotsService: SnapshotsService) {}

  @Cron("0 0 * * 0")
  async handleWeeklySnapshot(): Promise<void> {
    await this.snapshotsService.runWeeklySnapshot();
  }
}
