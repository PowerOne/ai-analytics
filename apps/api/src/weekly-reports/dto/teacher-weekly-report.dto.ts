import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ClassWeeklySummary } from "./class-weekly-summary.dto";
import { StudentAttentionSummary } from "./student-attention-summary.dto";

export class TeacherWeeklyReportResponse {
  @ApiProperty({ format: "uuid" })
  teacherId!: string;

  @ApiProperty({ type: [ClassWeeklySummary] })
  classes!: ClassWeeklySummary[];

  @ApiProperty({ type: [StudentAttentionSummary] })
  attentionStudents!: StudentAttentionSummary[];

  @ApiPropertyOptional({ nullable: true })
  aiSummary?: string | null;
}
