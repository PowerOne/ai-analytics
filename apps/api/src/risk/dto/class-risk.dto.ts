import { ApiProperty } from "@nestjs/swagger";
import { RiskLevel } from "./risk-level.enum";

export class ClassRiskResponse {
  @ApiProperty({ description: "Engagement risk (0–100, higher = riskier)", example: 42 })
  engagement!: number;

  @ApiProperty({ description: "Attendance risk (0–100)", example: 28 })
  attendance!: number;

  @ApiProperty({ description: "Performance risk (0–100)", example: 35 })
  performance!: number;

  @ApiProperty({ description: "Weighted overall risk (0–100)", example: 36 })
  overall!: number;

  @ApiProperty({ enum: RiskLevel, enumName: "RiskLevel" })
  level!: RiskLevel;
}
