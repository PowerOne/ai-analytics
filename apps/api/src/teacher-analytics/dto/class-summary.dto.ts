import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ClassAnalyticsResponse } from "../../analytics/dto/class-analytics.dto";
import { ClassInsightsResponse } from "../../insights/dto/class-insights.dto";
import { ClassRiskResponse } from "../../risk/dto/class-risk.dto";
import { StudentSummaryResponse } from "./student-summary.dto";

export class ClassSummaryResponse {
  @ApiProperty({ format: "uuid" })
  classId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: ClassAnalyticsResponse })
  analytics!: ClassAnalyticsResponse;

  @ApiProperty({ type: ClassRiskResponse })
  risk!: ClassRiskResponse;

  @ApiPropertyOptional({
    type: ClassInsightsResponse,
    description: "AI insights; null when the AI service is unavailable or errors",
    nullable: true,
  })
  insights!: ClassInsightsResponse | null;

  @ApiProperty({ type: [StudentSummaryResponse] })
  students!: StudentSummaryResponse[];
}
