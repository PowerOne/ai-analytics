import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { HeatmapCell } from "../../lms-heatmaps/dto/heatmap-cell.dto";

export class Student360CurrentBlockDto {
  @ApiProperty({ description: "Current mean performance (0–100) from analytics" })
  performance!: number;

  @ApiProperty({ description: "Current mean attendance rate (0–1) from analytics" })
  attendance!: number;

  @ApiProperty({ description: "Current LMS engagement score from analytics" })
  engagement!: number;

  @ApiProperty({ description: "Weighted overall risk (0–100)" })
  riskScore!: number;

  @ApiProperty({ description: "LOW | MEDIUM | HIGH" })
  riskTier!: string;
}

export class Student360HeatmapBlockDto {
  @ApiProperty({ type: [HeatmapCell] })
  daily!: HeatmapCell[];

  @ApiProperty({ type: [HeatmapCell] })
  weekly!: HeatmapCell[];
}

export class Student360DashboardResponse {
  @ApiProperty({ format: "uuid" })
  studentId!: string;

  @ApiProperty()
  performanceDelta!: number;

  @ApiProperty()
  attendanceDelta!: number;

  @ApiProperty()
  engagementDelta!: number;

  @ApiProperty()
  riskDelta!: number;

  @ApiProperty({ type: Student360CurrentBlockDto })
  current!: Student360CurrentBlockDto;

  @ApiProperty({ description: "Open + resolved interventions touching this student" })
  interventions!: number;

  @ApiProperty({ type: Student360HeatmapBlockDto })
  heatmap!: Student360HeatmapBlockDto;

  @ApiPropertyOptional({ nullable: true })
  aiSummary?: string | null;
}
