import { ApiProperty } from "@nestjs/swagger";

export class ClassWeeklySummary {
  @ApiProperty({ format: "uuid" })
  classId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: "Change in avg performance (score %) — last 7d vs previous 7d" })
  performanceDelta!: number;

  @ApiProperty({ description: "Change in attendance rate (0–1) — last 7d vs previous 7d" })
  attendanceDelta!: number;

  @ApiProperty({ description: "Change in LMS event counts — last 7d vs previous 7d" })
  engagementDelta!: number;

  @ApiProperty({
    description:
      "Class risk overall minus mean of student risk scores in this class (cross-sectional spread; 0 if unavailable)",
  })
  riskDelta!: number;

  @ApiProperty({ description: "Interventions created for this class in the last 7 days" })
  newInterventions!: number;
}
