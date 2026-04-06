import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { HeatmapCell } from "../../lms-heatmaps/dto/heatmap-cell.dto";
import { SchoolTrendSummary } from "../../principal-reports/dto/school-trend.dto";

export class PrincipalInterventionsBlockDto {
  @ApiProperty()
  created!: number;

  @ApiProperty()
  resolved!: number;

  @ApiProperty({ description: "resolved / max(created, 1), capped at 1" })
  resolutionRate!: number;
}

export class CohortDashboardSummary {
  @ApiProperty({ enum: ["GRADE", "SUBJECT"] })
  cohortType!: "GRADE" | "SUBJECT";

  @ApiProperty()
  cohortId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  performanceDelta!: number;

  @ApiProperty()
  attendanceDelta!: number;

  @ApiProperty()
  engagementDelta!: number;

  @ApiProperty({ description: "riskAverage this week − last week" })
  riskDelta!: number;

  @ApiProperty({
    description: "Risk distribution from latest weekly cohort snapshot",
  })
  risk!: { low: number; medium: number; high: number; average: number };

  @ApiProperty()
  interventions!: number;
}

export class PrincipalHeatmapBlockDto {
  @ApiProperty({ type: [HeatmapCell] })
  daily!: HeatmapCell[];

  @ApiProperty({ type: [HeatmapCell] })
  weekly!: HeatmapCell[];
}

export class PrincipalDashboardResponse {
  @ApiProperty({ format: "uuid" })
  schoolId!: string;

  @ApiProperty({ type: SchoolTrendSummary })
  schoolTrends!: SchoolTrendSummary;

  @ApiProperty({ type: [CohortDashboardSummary] })
  cohorts!: CohortDashboardSummary[];

  @ApiProperty({ type: PrincipalInterventionsBlockDto })
  interventions!: PrincipalInterventionsBlockDto;

  @ApiProperty({ type: PrincipalHeatmapBlockDto })
  heatmap!: PrincipalHeatmapBlockDto;

  @ApiPropertyOptional({ nullable: true })
  aiSummary?: string | null;
}
