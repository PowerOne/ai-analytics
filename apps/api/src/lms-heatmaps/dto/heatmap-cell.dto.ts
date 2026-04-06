import { ApiProperty } from "@nestjs/swagger";

export class HeatmapCell {
  @ApiProperty({ description: "Bucket start date (UTC), YYYY-MM-DD", example: "2026-04-01" })
  date!: string;

  @ApiProperty({ description: "Total LMS events in the bucket" })
  count!: number;

  @ApiProperty({
    description: "Counts per event_type",
    type: Object,
    example: { page_view: 4, submission: 1 },
  })
  eventTypes!: Record<string, number>;
}
