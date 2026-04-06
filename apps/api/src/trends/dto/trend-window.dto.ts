import { ApiProperty } from "@nestjs/swagger";

export class TrendWindowDto {
  @ApiProperty({
    description: "ISO-8601 Monday 00:00 UTC start of the current ISO week",
    example: "2026-04-06T00:00:00.000Z",
  })
  thisWeekStart!: string;

  @ApiProperty({
    description: "ISO-8601 Monday 00:00 UTC start of the previous ISO week",
    example: "2026-03-30T00:00:00.000Z",
  })
  lastWeekStart!: string;
}
