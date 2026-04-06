import { ApiProperty } from "@nestjs/swagger";

export class CohortRiskBlockDto {
  @ApiProperty()
  low!: number;

  @ApiProperty()
  medium!: number;

  @ApiProperty()
  high!: number;

  @ApiProperty({ description: "Mean overall risk (0–100)" })
  average!: number;
}

export class CohortSummary {
  @ApiProperty({ description: "Grade key or subject UUID" })
  id!: string;

  @ApiProperty({ enum: ["grade", "subject"] })
  type!: "grade" | "subject";

  @ApiProperty()
  name!: string;

  @ApiProperty()
  performance!: number;

  @ApiProperty()
  attendance!: number;

  @ApiProperty()
  engagement!: number;

  @ApiProperty({ type: CohortRiskBlockDto })
  risk!: CohortRiskBlockDto;

  @ApiProperty()
  interventions!: number;
}
