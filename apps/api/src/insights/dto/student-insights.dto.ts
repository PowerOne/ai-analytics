import { ApiProperty } from "@nestjs/swagger";

export class StudentInsightsResponse {
  @ApiProperty({ description: "Natural-language summary of student analytics" })
  summary!: string;

  @ApiProperty({ type: [String], description: "Key risk flags identified by the AI" })
  risks!: string[];

  @ApiProperty({ type: [String], description: "Actionable recommendations" })
  recommendations!: string[];
}
