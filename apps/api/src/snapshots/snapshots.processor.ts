import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { SnapshotsService } from "./snapshots.service";

@Injectable()
export class SnapshotsProcessor {
  private readonly logger = new Logger(SnapshotsProcessor.name);

  constructor(private readonly snapshotsService: SnapshotsService) {}

  /** Monday 02:00 UTC — snapshot the week that just ended. */
  @Cron("0 2 * * 1")
  async handleWeeklySnapshot(): Promise<void> {
    this.logger.log("Starting weekly snapshot job…");
    await this.snapshotsService.runWeeklySnapshot();
  }
}
