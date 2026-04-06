import { ApiProperty } from "@nestjs/swagger";

export class TrendPoint {
  @ApiProperty({ description: "Calendar day in YYYY-MM-DD (UTC)", example: "2026-04-01" })
  date!: string;

  @ApiProperty({ description: "Metric value for that day", example: 82.5 })
  value!: number;
}
