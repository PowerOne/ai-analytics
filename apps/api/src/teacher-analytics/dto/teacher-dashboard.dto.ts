import { ApiProperty } from "@nestjs/swagger";
import { ClassSummaryResponse } from "./class-summary.dto";

export class TeacherDashboardResponse {
  @ApiProperty({ format: "uuid" })
  teacherId!: string;

  @ApiProperty({ type: [ClassSummaryResponse], description: "Classes where this teacher is the primary teacher" })
  classes!: ClassSummaryResponse[];
}
