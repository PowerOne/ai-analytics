import { ApiProperty } from "@nestjs/swagger";
import { RiskLevel } from "./risk-level.enum";

export class StudentRiskResponse {
  @ApiProperty({ description: "Engagement risk (0–100, higher = riskier)", example: 55 })
  engagement!: number;

  @ApiProperty({ description: "Attendance risk (0–100)", example: 40 })
  attendance!: number;

  @ApiProperty({ description: "Performance risk (0–100)", example: 48 })
  performance!: number;

  @ApiProperty({ description: "Weighted overall risk (0–100)", example: 49 })
  overall!: number;

  @ApiProperty({ enum: RiskLevel, enumName: "RiskLevel" })
  level!: RiskLevel;
}
