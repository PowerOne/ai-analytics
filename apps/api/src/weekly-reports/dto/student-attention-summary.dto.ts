import { ApiProperty } from "@nestjs/swagger";

export class StudentAttentionSummary {
  @ApiProperty({ format: "uuid" })
  studentId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: "Avg score % last 7d minus previous 7d (from timelines)" })
  performanceDelta!: number;

  @ApiProperty({ description: "Avg attendance rate last 7d minus previous 7d" })
  attendanceDelta!: number;

  @ApiProperty({ description: "LMS event count last 7d minus previous 7d" })
  engagementDelta!: number;

  @ApiProperty({
    description: "Reserved for week-over-week risk change; 0 without historical snapshots",
  })
  riskDelta!: number;

  @ApiProperty({ description: "Interventions touching this student in the last 7 days" })
  interventionsThisWeek!: number;

  @ApiProperty({
    description:
      "Snapshot-based stability: perf/att/eng deltas plus inverted risk change (this week vs last week snapshots)",
  })
  stability!: number;

  @ApiProperty({ description: "thisWeek.riskComposite − lastWeek.riskComposite (Risk Engine)" })
  riskEngineDelta!: number;

  @ApiProperty({ description: "AI-generated intervention suggestions (dashboards only)" })
  interventions!: unknown[];
}
