import { ApiProperty } from "@nestjs/swagger";
import { TrendPoint } from "./common.dto";

export class StudentAnalyticsResponse {
  @ApiProperty({ type: [TrendPoint], description: "Daily average score percent" })
  scoreTimeline!: TrendPoint[];

  @ApiProperty({
    type: [TrendPoint],
    description: "Daily attendance rate (present-like / sessions that day)",
  })
  attendanceTimeline!: TrendPoint[];

  @ApiProperty({
    description: "Average LMS engagement score for this student",
    example: 0.65,
  })
  engagementScore!: number;

  @ApiProperty({
    description: "Share of assessment results with a submission timestamp",
    example: 0.91,
  })
  submissionRate!: number;
}
