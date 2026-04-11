import { ApiProperty } from "@nestjs/swagger";

export class SchoolTrendSummary {
  @ApiProperty({ description: "Pooled performance % change: last 7d vs previous 7d (UTC)" })
  performanceDelta!: number;

  @ApiProperty({ description: "Pooled attendance % change: last 7d vs previous 7d" })
  attendanceDelta!: number;

  @ApiProperty({ description: "LMS engagement % change: last 7d vs previous 7d (cohort aggregate)" })
  engagementDelta!: number;

  @ApiProperty({
    description: "Reserved for week-over-week mean risk delta; 0 without historical snapshots",
  })
  riskDelta!: number;

  @ApiProperty({
    description:
      "Count of students in the HIGH risk band (current snapshot; use as proxy when historical “new high-risk” is unavailable)",
  })
  highRiskNew!: number;

  @ApiProperty({ description: "thisWeek.riskComposite − lastWeek.riskComposite (Risk Engine)" })
  riskCompositeDelta!: number;
}
