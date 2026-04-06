import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { HeatmapCell } from "../../lms-heatmaps/dto/heatmap-cell.dto";

export class CohortRiskBlockDto {
  @ApiProperty()
  low!: number;

  @ApiProperty()
  medium!: number;

  @ApiProperty()
  high!: number;

  @ApiProperty()
  average!: number;
}

export class CohortHeatmapBlockDto {
  @ApiProperty({ type: [HeatmapCell] })
  daily!: HeatmapCell[];

  @ApiProperty({ type: [HeatmapCell] })
  weekly!: HeatmapCell[];
}

export class CohortDashboardResponse {
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

  @ApiProperty()
  riskDelta!: number;

  @ApiProperty({ type: CohortRiskBlockDto })
  risk!: CohortRiskBlockDto;

  @ApiProperty()
  interventions!: number;

  @ApiProperty({ type: CohortHeatmapBlockDto })
  heatmap!: CohortHeatmapBlockDto;

  @ApiPropertyOptional({ nullable: true })
  aiSummary?: string | null;
}
