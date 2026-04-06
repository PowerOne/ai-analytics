import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { StudentAnalyticsResponse } from "../../analytics/dto/student-analytics.dto";
import { StudentInsightsResponse } from "../../insights/dto/student-insights.dto";
import { StudentRiskResponse } from "../../risk/dto/student-risk.dto";

export class StudentSummaryResponse {
  @ApiProperty({ format: "uuid" })
  studentId!: string;

  @ApiProperty({ description: "Display name for the student" })
  name!: string;

  @ApiProperty({ type: StudentAnalyticsResponse })
  analytics!: StudentAnalyticsResponse;

  @ApiProperty({ type: StudentRiskResponse })
  risk!: StudentRiskResponse;

  @ApiPropertyOptional({
    type: StudentInsightsResponse,
    description: "AI insights; null when the AI service is unavailable or errors",
    nullable: true,
  })
  insights!: StudentInsightsResponse | null;
}
