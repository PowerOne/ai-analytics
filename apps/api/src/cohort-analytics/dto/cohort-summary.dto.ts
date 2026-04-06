import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CohortRiskBreakdownDto {
  @ApiProperty({ example: 12 })
  low!: number;

  @ApiProperty({ example: 8 })
  medium!: number;

  @ApiProperty({ example: 3 })
  high!: number;

  @ApiProperty({ description: "Mean overall risk score (0–100)", example: 41.2 })
  average!: number;
}

export class CohortTrendsDto {
  @ApiProperty({ description: "Performance % change: last 7d vs previous 7d (pooled)", example: 2.5 })
  performance7!: number;

  @ApiProperty({ description: "Attendance % change: last 7d vs previous 7d (pooled)", example: -1.2 })
  attendance7!: number;

  @ApiProperty({ description: "Engagement % change: last 7d vs previous 7d (LMS cohort aggregate)", example: 0.5 })
  engagement7!: number;

  @ApiProperty({ description: "Performance % change: last 30d vs previous 30d", example: 3.1 })
  performance30!: number;

  @ApiProperty({ description: "Attendance % change: last 30d vs previous 30d", example: -0.8 })
  attendance30!: number;

  @ApiProperty({ description: "Engagement % change: last 30d vs previous 30d", example: 1.0 })
  engagement30!: number;
}

export class CohortSummaryResponse {
  @ApiProperty({ description: "Grade key or subject UUID" })
  id!: string;

  @ApiProperty({ example: "Grade 9" })
  name!: string;

  @ApiProperty({ description: "Average performance score (0–100)", example: 76.4 })
  performance!: number;

  @ApiProperty({ description: "Average attendance rate (0–1)", example: 0.91 })
  attendance!: number;

  @ApiProperty({ description: "Average engagement score (LMS aggregate scale)", example: 0.62 })
  engagement!: number;

  @ApiProperty({ type: CohortRiskBreakdownDto })
  risk!: CohortRiskBreakdownDto;

  @ApiProperty({ description: "Interventions linked to cohort classes or students" })
  interventions!: number;

  @ApiProperty({ type: CohortTrendsDto })
  trends!: CohortTrendsDto;

  @ApiPropertyOptional({ nullable: true, description: "AI narrative when AI service succeeds" })
  aiSummary?: string | null;
}
