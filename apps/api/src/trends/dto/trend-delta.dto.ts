import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/** Unified week-over-week deltas (snapshot-based when available). */
export class TrendDeltaDto {
  @ApiProperty({ description: "Performance metric delta (this week − last week)" })
  performanceDelta!: number;

  @ApiProperty({ description: "Attendance metric delta (this week − last week)" })
  attendanceDelta!: number;

  @ApiProperty({ description: "Engagement metric delta (this week − last week)" })
  engagementDelta!: number;

  @ApiProperty({ description: "Risk metric delta (this week − last week)" })
  riskDelta!: number;

  @ApiPropertyOptional({
    description:
      "Student: 1 if newly HIGH vs last week; school: HIGH-tier count from latest snapshot; otherwise omitted",
  })
  highRiskNew?: number;
}
