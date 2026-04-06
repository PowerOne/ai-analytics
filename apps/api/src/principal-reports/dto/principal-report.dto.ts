import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { HeatmapCell } from "../../lms-heatmaps/dto/heatmap-cell.dto";
import { CohortSummary } from "./cohort-summary.dto";
import { SchoolTrendSummary } from "./school-trend.dto";

export class InterventionActivityDto {
  @ApiProperty()
  created!: number;

  @ApiProperty()
  resolved!: number;

  @ApiProperty({ description: "Resolved / max(created, 1), capped at 1", example: 0.42 })
  resolutionRate!: number;

  @ApiProperty({
    description: "Interventions created in last 7d per teacher id",
    type: "object",
    additionalProperties: true,
  })
  teacherLoad!: Record<string, number>;
}

export class EngagementBlockDto {
  @ApiProperty({ type: [HeatmapCell], description: "Daily LMS buckets (last 14d window)" })
  daily!: HeatmapCell[];

  @ApiProperty({ type: [HeatmapCell], description: "Weekly LMS buckets" })
  weekly!: HeatmapCell[];

  @ApiProperty({ description: "Event count last 7d minus previous 7d (school-wide)" })
  engagementDelta!: number;
}

export class PrincipalReportResponse {
  @ApiProperty({ format: "uuid" })
  schoolId!: string;

  @ApiProperty({ description: "ISO-8601 timestamp when the report was built" })
  generatedAt!: string;

  @ApiProperty({ type: SchoolTrendSummary })
  schoolTrends!: SchoolTrendSummary;

  @ApiProperty({ type: [CohortSummary] })
  cohorts!: CohortSummary[];

  @ApiProperty({ type: InterventionActivityDto })
  interventions!: InterventionActivityDto;

  @ApiProperty({ type: EngagementBlockDto })
  engagement!: EngagementBlockDto;

  @ApiPropertyOptional({ nullable: true })
  aiSummary?: string | null;
}
