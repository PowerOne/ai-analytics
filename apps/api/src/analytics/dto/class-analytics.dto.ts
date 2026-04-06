import { ApiProperty } from "@nestjs/swagger";
import { TrendPoint } from "./common.dto";

export class ClassAnalyticsResponse {
  @ApiProperty({ description: "Average assessment score percent for the class", example: 78.2 })
  averageScore!: number;

  @ApiProperty({ type: [TrendPoint], description: "Daily average score trend" })
  scoreTrend!: TrendPoint[];

  @ApiProperty({
    description: "Share of attendance sessions marked present-like (present, late, excused)",
    example: 0.94,
  })
  attendanceRate!: number;

  @ApiProperty({
    description: "Share of assessment results with a submission timestamp",
    example: 0.88,
  })
  submissionRate!: number;

  @ApiProperty({
    description: "Average LMS engagement score for activity in this class",
    example: 0.72,
  })
  engagementScore!: number;
}
