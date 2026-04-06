import { ApiProperty } from "@nestjs/swagger";

export class ClassInsightsResponse {
  @ApiProperty({ description: "Natural-language summary of class analytics" })
  summary!: string;

  @ApiProperty({ type: [String], description: "Key risk flags identified by the AI" })
  risks!: string[];

  @ApiProperty({ type: [String], description: "Actionable recommendations" })
  recommendations!: string[];
}
