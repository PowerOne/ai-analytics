import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { HeatmapCell } from "./heatmap-cell.dto";

export class SchoolHeatmapResponse {
  @ApiProperty({ format: "uuid" })
  schoolId!: string;

  @ApiProperty({ type: [HeatmapCell] })
  heatmap!: HeatmapCell[];

  @ApiProperty({ type: [HeatmapCell] })
  weekly!: HeatmapCell[];

  @ApiProperty({ type: [HeatmapCell] })
  monthly!: HeatmapCell[];

  @ApiPropertyOptional({ nullable: true })
  aiSummary?: string | null;
}
