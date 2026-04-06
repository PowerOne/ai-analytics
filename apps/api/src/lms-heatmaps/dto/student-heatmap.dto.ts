import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { HeatmapCell } from "./heatmap-cell.dto";

export class StudentHeatmapResponse {
  @ApiProperty({ format: "uuid" })
  studentId!: string;

  @ApiProperty({ type: [HeatmapCell], description: "Daily buckets (UTC calendar days)" })
  heatmap!: HeatmapCell[];

  @ApiProperty({ type: [HeatmapCell], description: "Weekly buckets (UTC, key = week-start Monday)" })
  weekly!: HeatmapCell[];

  @ApiProperty({ type: [HeatmapCell], description: "Monthly buckets (UTC, key = first of month)" })
  monthly!: HeatmapCell[];

  @ApiPropertyOptional({ nullable: true })
  aiSummary?: string | null;
}
